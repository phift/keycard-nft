import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWeb3Modal, useWeb3Modal } from "@web3modal/wagmi/react";
import { createConfig, WagmiProvider, useAccount, useDisconnect, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { defineChain, getAddress, isAddress } from "viem";

type Config = {
  apiBaseUrl: string;
  chainId: number;
  contractAddress: string;
  explorerBaseUrl: string;
  walletConnectProjectId?: string;
};

type MintRecord = {
  recipientRaw: string;
  resolvedAddress: string;
  txHash: string;
  tokenId: string;
  mintedAtISO: string;
};

type MintedLookup = {
  address: string;
  tokenIds: string[];
  count: number;
  lastTokenId: string | null;
};

type NftMetadata = {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
};

const queryClient = new QueryClient();
const STATUS_RPC_URL = "https://public.sepolia.rpc.status.network";
const statusTestnet = defineChain({
  id: 1660990954,
  name: "Status Network Testnet",
  network: "status-testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [STATUS_RPC_URL] },
    public: { http: [STATUS_RPC_URL] }
  },
  blockExplorers: {
    default: { name: "Status SepoliaScan", url: "https://sepoliascan.status.network" }
  }
});

const EVENT_COPY = "ps.logos.co | Lisbon | 6-7 March 2026";
const TAP_KEY_STORAGE = "psk26:tapKey";
const METADATA_PATH = "metadata.json";

function buildMintKey(config: Config) {
  return `psk26:minted:${config.chainId}:${config.contractAddress.toLowerCase()}`;
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [tapKey, setTapKey] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolveStatus, setResolveStatus] = useState<"idle" | "resolving" | "resolved" | "error">("idle");
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [mintStatus, setMintStatus] = useState<"idle" | "minting" | "success" | "error">("idle");
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintedRecord, setMintedRecord] = useState<MintRecord | null>(null);
  const [metadata, setMetadata] = useState<NftMetadata | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mintedLookup, setMintedLookup] = useState<MintedLookup | null>(null);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "error">("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [wagmiConfig, setWagmiConfig] = useState<ReturnType<typeof createConfig> | null>(null);

  const resolveTimeout = useRef<number | null>(null);
  const modalConfigured = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("k") || "";
    const fromStorage = sessionStorage.getItem(TAP_KEY_STORAGE) || "";
    const effectiveKey = fromQuery || fromStorage;

    if (fromQuery) {
      sessionStorage.setItem(TAP_KEY_STORAGE, fromQuery);
      params.delete("k");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }

    setTapKey(effectiveKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const res = await fetch("config.json", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load config.json");
        }
        const data = (await res.json()) as Config;
        if (!cancelled) {
          setConfig(data);
        }
      } catch (error) {
        if (!cancelled) {
          setConfigError("Missing or invalid config.json");
        }
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config?.walletConnectProjectId) {
      return;
    }
    if (modalConfigured.current) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const projectId = config.walletConnectProjectId;
    const metadata = {
      name: "PSK26 Tap Mint",
      description: "Parallel Society x Keycard 2026 mint",
      url: window.location.origin,
      icons: [`${window.location.origin}/nft.svg`]
    };

    const nextConfig = createConfig({
      chains: [statusTestnet],
      transports: {
        [statusTestnet.id]: http(STATUS_RPC_URL)
      },
      connectors: [
        injected(),
        walletConnect({ projectId, metadata, showQrModal: false })
      ]
    });

    setWagmiConfig(nextConfig);
    createWeb3Modal({
      wagmiConfig: nextConfig,
      projectId,
      chains: [statusTestnet]
    });
    modalConfigured.current = true;
  }, [config?.walletConnectProjectId]);

  useEffect(() => {
    let cancelled = false;
    async function loadMetadata() {
      try {
        const res = await fetch(METADATA_PATH, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load metadata.json");
        }
        const data = (await res.json()) as NftMetadata;
        if (!cancelled) {
          setMetadata(data);
        }
      } catch {
        if (!cancelled) {
          setMetadata(null);
        }
      }
    }

    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config) {
      return;
    }

    if (!config.apiBaseUrl) {
      setConfigError("apiBaseUrl missing in config.json");
      return;
    }
    if (!config.contractAddress || !isAddress(config.contractAddress)) {
      setConfigError("contractAddress missing or invalid in config.json");
      return;
    }

    setConfigError(null);
    const stored = localStorage.getItem(buildMintKey(config));
    if (stored) {
      try {
        setMintedRecord(JSON.parse(stored) as MintRecord);
      } catch {
        localStorage.removeItem(buildMintKey(config));
      }
    }
  }, [config]);

  useEffect(() => {
    if (!config) {
      return;
    }
    const address = walletAddress || mintedRecord?.resolvedAddress || null;
    if (!address) {
      setMintedLookup(null);
      setLookupStatus("idle");
      setLookupError(null);
      return;
    }
    void loadMintedForAddress(address);
  }, [walletAddress, mintedRecord, config]);

  useEffect(() => {
    if (!recipientInput.trim()) {
      setResolvedAddress(null);
      setResolveStatus("idle");
      setResolveError(null);
      return;
    }

    if (resolveTimeout.current) {
      window.clearTimeout(resolveTimeout.current);
    }

    resolveTimeout.current = window.setTimeout(async () => {
      const value = recipientInput.trim();
      setResolveError(null);

      if (value.toLowerCase().endsWith(".eth")) {
        if (!config?.apiBaseUrl) {
          return;
        }
        setResolveStatus("resolving");
        try {
          const res = await fetch(
            `${config.apiBaseUrl}/api/resolve?name=${encodeURIComponent(value)}`
          );
          if (!res.ok) {
            setResolveStatus("error");
            setResolveError("ENS name not found");
            setResolvedAddress(null);
            return;
          }
          const data = (await res.json()) as { address?: string };
          if (data.address && isAddress(data.address)) {
            setResolvedAddress(getAddress(data.address));
            setResolveStatus("resolved");
            return;
          }
          setResolveStatus("error");
          setResolveError("ENS name not found");
        } catch (error) {
          setResolveStatus("error");
          setResolveError("ENS lookup failed");
        }
        return;
      }

      if (isAddress(value)) {
        setResolvedAddress(getAddress(value));
        setResolveStatus("resolved");
        return;
      }

      setResolvedAddress(null);
      setResolveStatus("error");
      setResolveError("Enter a valid ENS name or 0x address");
    }, 400);

    return () => {
      if (resolveTimeout.current) {
        window.clearTimeout(resolveTimeout.current);
      }
    };
  }, [recipientInput, config]);

  const canMint =
    Boolean(config) &&
    !configError &&
    !mintedRecord &&
    resolveStatus === "resolved" &&
    Boolean(resolvedAddress);

  async function handleMint() {
    if (!config) {
      return;
    }
    if (!tapKey) {
      setMintError("This link is missing access. Please use the booth link.");
      return;
    }

    const trimmed = recipientInput.trim();
    if (!trimmed) {
      setMintError("Enter an ENS name or address");
      return;
    }

    const requestId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setMintStatus("minting");
    setMintError(null);

    try {
      const res = await fetch(`${config.apiBaseUrl}/api/mint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tap-key": tapKey
        },
        body: JSON.stringify({ recipient: trimmed, requestId })
      });

      const data = (await res.json()) as {
        resolvedAddress?: string;
        txHash?: string;
        tokenId?: string;
        error?: string;
      };

      if (!res.ok) {
        if (res.status === 403) {
          setMintError("Invalid tap key. Please tap the NFC tag again.");
        } else if (res.status === 429) {
          setMintError("Mint limit reached for this address.");
        } else {
          setMintError(data.error || "Mint failed");
        }
        setMintStatus("error");
        return;
      }

      const record: MintRecord = {
        recipientRaw: trimmed,
        resolvedAddress: data.resolvedAddress || resolvedAddress || "",
        txHash: data.txHash || "",
        tokenId: data.tokenId || "",
        mintedAtISO: new Date().toISOString()
      };

      localStorage.setItem(buildMintKey(config), JSON.stringify(record));
      setMintedRecord(record);
      setMintStatus("success");
    } catch (error) {
      setMintStatus("error");
      setMintError("Mint failed. Please try again.");
    }
  }

  async function loadMintedForAddress(address: string) {
    if (!config?.apiBaseUrl) {
      return;
    }
    setLookupStatus("loading");
    setLookupError(null);
    try {
      const res = await fetch(
        `${config.apiBaseUrl}/api/minted?address=${encodeURIComponent(address)}`
      );
      const data = (await res.json()) as {
        address?: string;
        tokenIds?: string[];
        count?: number;
        lastTokenId?: string | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Lookup failed");
      }
      const tokenIds = Array.isArray(data.tokenIds) ? data.tokenIds : [];
      setMintedLookup({
        address: data.address || address,
        tokenIds,
        count: data.count ?? tokenIds.length,
        lastTokenId: data.lastTokenId ?? (tokenIds[tokenIds.length - 1] || null)
      });
      setLookupStatus("idle");
    } catch (error) {
      setLookupStatus("error");
      setLookupError(error instanceof Error ? error.message : "Lookup failed");
    }
  }

  function resetLocalMint() {
    if (!config) {
      return;
    }
    localStorage.removeItem(buildMintKey(config));
    setMintedRecord(null);
    setMintStatus("idle");
    setMintError(null);
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="brand">PSK26</div>
        <div className="title">Parallel Society x Keycard 2026</div>
        <div className="subtitle">{EVENT_COPY}</div>
      </header>

      <main className="card">
        <div className="card-header">
          <h1>Tap Mint</h1>
          <p>
            Enter your address or ENS name. The relayer will mint to that
            address on Status Network Testnet.
          </p>
        </div>

        {configError && (
          <div className="notice error">Configuration error: {configError}</div>
        )}

        {mintedRecord ? (
          <div className="minted">
            <div className="badge">Already minted on this device</div>
            {metadata?.image && (
              <div className="nft-preview">
                <img src={metadata.image} alt={metadata.name || "NFT preview"} />
                <div className="nft-details">
                  <div className="nft-title">{metadata.name || "PSK26 NFT"}</div>
                  {metadata.description && (
                    <div className="nft-description">{metadata.description}</div>
                  )}
                  {mintedLookup?.count ? (
                    <div className="nft-meta">
                      {mintedLookup.count} mint
                      {mintedLookup.count === 1 ? "" : "s"} found
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            <div className="minted-details">
              <div>
                <span className="label">Recipient</span>
                <span className="value">{mintedRecord.resolvedAddress}</span>
              </div>
              <div>
                <span className="label">Token ID</span>
                <span className="value">{mintedRecord.tokenId || "Pending"}</span>
              </div>
              <div>
                <span className="label">Tx</span>
                {config?.explorerBaseUrl && mintedRecord.txHash ? (
                  <a
                    href={`${config.explorerBaseUrl}/tx/${mintedRecord.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="link"
                  >
                    View on explorer
                  </a>
                ) : (
                  <span className="value">{mintedRecord.txHash || "Pending"}</span>
                )}
              </div>
            </div>
            <button className="reset" onClick={resetLocalMint}>
              Reset (advanced)
            </button>
          </div>
        ) : (
          <div className="form">
            <label htmlFor="recipient">Recipient (ENS or 0x address)</label>
            <input
              id="recipient"
              type="text"
              placeholder="vitalik.eth or 0x..."
              value={recipientInput}
              onChange={(event) => setRecipientInput(event.target.value)}
              autoComplete="off"
            />

            <div className="resolve">
              {resolveStatus === "resolving" && (
                <span className="muted">Resolving ENS...</span>
              )}
              {resolveStatus === "resolved" && resolvedAddress && (
                <span className="resolved">Resolved: {resolvedAddress}</span>
              )}
              {resolveStatus === "error" && resolveError && (
                <span className="error-text">{resolveError}</span>
              )}
            </div>

            <button
              className="mint"
              onClick={handleMint}
              disabled={!canMint || mintStatus === "minting"}
            >
              {mintStatus === "minting" ? "Minting..." : "MINT"}
            </button>

            {mintError && <div className="notice error">{mintError}</div>}
            {mintStatus === "success" && !mintError && (
              <div className="notice success">Minted successfully.</div>
            )}
            {config && (
              <WalletSection
                config={config}
                metadata={metadata}
                mintedLookup={mintedLookup}
                lookupStatus={lookupStatus}
                lookupError={lookupError}
                wagmiConfig={wagmiConfig}
                onAddressChange={setWalletAddress}
              />
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Status Network Testnet</span>
        <span>PSK26</span>
      </footer>
    </div>
  );
}

type WalletSectionProps = {
  config: Config;
  metadata: NftMetadata | null;
  mintedLookup: MintedLookup | null;
  lookupStatus: "idle" | "loading" | "error";
  lookupError: string | null;
  wagmiConfig: ReturnType<typeof createConfig> | null;
  onAddressChange: (address: string | null) => void;
};

function WalletSection({
  config,
  metadata,
  mintedLookup,
  lookupStatus,
  lookupError,
  wagmiConfig,
  onAddressChange
}: WalletSectionProps) {
  if (!config.walletConnectProjectId) {
    return (
      <div className="wallet-panel">
        <div className="wallet-title">Already minted?</div>
        <div className="wallet-copy">
          Wallet login is disabled until a WalletConnect project ID is configured.
        </div>
      </div>
    );
  }

  if (!wagmiConfig) {
    return (
      <div className="wallet-panel">
        <div className="wallet-title">Already minted?</div>
        <div className="wallet-copy">Loading wallet connector...</div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletPanel
          metadata={metadata}
          mintedLookup={mintedLookup}
          lookupStatus={lookupStatus}
          lookupError={lookupError}
          onAddressChange={onAddressChange}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

type WalletPanelProps = {
  metadata: NftMetadata | null;
  mintedLookup: MintedLookup | null;
  lookupStatus: "idle" | "loading" | "error";
  lookupError: string | null;
  onAddressChange: (address: string | null) => void;
};

function WalletPanel({
  metadata,
  mintedLookup,
  lookupStatus,
  lookupError,
  onAddressChange
}: WalletPanelProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useWeb3Modal();

  useEffect(() => {
    if (isConnected && address) {
      onAddressChange(getAddress(address));
      return;
    }
    onAddressChange(null);
  }, [address, isConnected, onAddressChange]);

  return (
    <div className="wallet-panel">
      <div className="wallet-title">Already minted?</div>
      <div className="wallet-copy">
        Connect a wallet to check if you already hold PSK26.
      </div>
      <div className="wallet-buttons">
        <button type="button" className="secondary" onClick={() => open()}>
          {isConnected ? "Wallet options" : "Connect wallet"}
        </button>
        {isConnected && (
          <button type="button" className="secondary" onClick={() => disconnect()}>
            Disconnect
          </button>
        )}
      </div>
      {isConnected && address && (
        <div className="wallet-meta">
          <span>Connected: {getAddress(address)}</span>
        </div>
      )}
      {lookupStatus === "loading" && <div className="muted">Checking mints...</div>}
      {lookupStatus === "error" && lookupError && (
        <div className="notice error">{lookupError}</div>
      )}
      {isConnected && mintedLookup && mintedLookup.count === 0 && (
        <div className="notice warning">No mints found for this wallet.</div>
      )}
      {isConnected && mintedLookup && mintedLookup.count > 0 && metadata?.image && (
        <div className="nft-preview">
          <img src={metadata.image} alt={metadata.name || "NFT preview"} />
          <div className="nft-details">
            <div className="nft-title">{metadata.name || "PSK26 NFT"}</div>
            {metadata.description && (
              <div className="nft-description">{metadata.description}</div>
            )}
            <div className="nft-meta">
              {mintedLookup.count} mint{mintedLookup.count === 1 ? "" : "s"} found
            </div>
            {mintedLookup.lastTokenId && (
              <div className="nft-meta">Latest Token ID: {mintedLookup.lastTokenId}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
