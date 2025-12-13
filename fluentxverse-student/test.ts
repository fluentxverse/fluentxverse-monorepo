import { createThirdwebClient } from "thirdweb";
import { ThirdwebProvider, useConnect, useActiveAccount } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";

const client = createThirdwebClient({ clientId: "your-client-id" });
const wallet = inAppWallet();

// 1. Wrap your app with ThirdwebProvider
function App() {
  return (
    <ThirdwebProvider>
      <MyComponent />
    </ThirdwebProvider>
  );
}

// 2. Custom hook approach
function MyComponent() {
  const { connect } = useConnect();
  // Once connected, you can access the active account
  const activeAccount = useActiveAccount();
  console.log("Connected as:", activeAccount?.address);

  const handleLogin = async () => {
    await connect(async () => {
      await wallet.connect({
        client,
        strategy: "apple", // specify auth strategies
      });
      return wallet;
    });
  };

  return <button onClick={handleLogin}>Connect</button>;
}

// 3. Or use prebuilt UI components (ConnectButton/ConnectEmbed)
function PrebuiltUIExample() {
  const walletWithAuth = inAppWallet({
    auth: { options: ["google"] },
    metadata: {
      name: "My App",
      icon: "https://example.com/icon.png",
      image: {
        src: "https://example.com/logo.png",
        alt: "My logo",
        width: 100,
        height: 100,
      },
    },
  });

  return <ConnectButton client={client} wallets={[walletWithAuth]} />;
}
