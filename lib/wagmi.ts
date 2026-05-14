import { http, createConfig } from "wagmi";
import { polygon } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains: [polygon],
  connectors: [
    injected(),
    ...(projectId
      ? [walletConnect({ projectId })]
      : []),
  ],
  transports: {
    [polygon.id]: http(),
  },
});
