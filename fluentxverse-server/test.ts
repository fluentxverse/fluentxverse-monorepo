import { thirdwebClient } from "@/services/utils.services/utils";
import { createThirdwebClient, defineChain, Engine, getContract, sendTransaction } from "thirdweb";
import { mintTo } from "thirdweb/extensions/erc1155";
import { mintAdditionalSupplyTo } from "thirdweb/extensions/erc1155";
import { createWallet } from "thirdweb/wallets";
import { upload } from "thirdweb/storage";
import * as fs from "fs";
import * as path from "path";


const client = thirdwebClient;




// connect to your contract
const contract =  getContract({
  client,
  chain: defineChain(421614),
  address: "0x6fB1BbF7929AF18Dbd6f4F15b03307d067E838db",
});


const serverWallet = Engine.serverWallet({
  client,
  address: process.env.THIRDWEB_VAULT_WALLET_ADDRESS!,
  vaultAccessToken: process.env.THIRDWEB_VAULT_ACCESS_TOKEN!,
});



const test = async () => {
    try {
        // Step 1: Upload the image to IPFS
        console.log("Uploading image to IPFS...");
        
        // Option A: Upload from a local file
        // const imagePath = path.join(__dirname, "assets", "ticket-basic.png");
        // const imageBuffer = fs.readFileSync(imagePath);
        // const imageFile = new File([imageBuffer], "ticket-basic.png", { type: "image/png" });
        
        // Option B: Upload from a URL/buffer (example with a placeholder)
        const imageFile = new File(
            [Buffer.from("placeholder-image-data")], 
            "ticket-nft.png", 
            { type: "image/png" }
        );
        
        const imageUri = await upload({
            client,
            files: [imageFile],
        });
        
        console.log("Image uploaded to IPFS:", imageUri);
        
        // Step 2: Mint the NFT with the uploaded image URI
        console.log("Minting NFT...");
        
        const transaction = mintTo({
            contract,
            to: "0xa2a3D233b95fCB94409555B12444399d4b72E239",
            nft: {
                name: "Basic Lesson Ticket",
                description: "1 Basic lesson ticket for FluentXVerse - Valid for 1 year",
                image: imageUri, // Use the uploaded IPFS URI
                attributes: [
                    { trait_type: "Tier", value: "Basic" },
                    { trait_type: "Tickets", value: "1" },
                    { trait_type: "Validity", value: "1 Year" },
                    { trait_type: "Lesson Duration", value: "25 minutes" },
                ],
            },
            supply: 1n,
        });

        const { transactionId } = await serverWallet.enqueueTransaction({
            transaction,
            simulate: false,
        });

        console.log("Transaction ID:", transactionId);
        console.log("NFT minted successfully!");
    } catch (error) {
        console.error("Error minting NFT:", error);
    }
}



await test();
// async function createServerWallet(label: string) {
//     const serverWallet = await Engine.createServerWallet({
//         client,
//         label,
//     });
//     return serverWallet;

// }


