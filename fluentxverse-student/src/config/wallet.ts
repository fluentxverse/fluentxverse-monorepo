import { createThirdwebClient } from "thirdweb";
import { inAppWallet } from "thirdweb/wallets";

// Thirdweb client
export const thirdwebClient = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || "your-client-id"
});

// Shared wallet configuration for the app
// This wallet is used for both login and auto-connect
export const appWallet = inAppWallet({
  auth: {
    options: ["google", "apple", "line", "tiktok", "telegram"],
  },
  executionMode: {
    mode: "EIP7702",
    sponsorGas: true,
  },
});
