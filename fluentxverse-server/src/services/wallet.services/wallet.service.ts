//** THIRDWEB IMPORT */
import { Engine } from "thirdweb";

//** UTILS IMPORTS */
import { thirdwebClient } from "../utils.services/utils";



class WalletService {
    public async createServerWallet(label: string) {
        const serverWallet = await Engine.createServerWallet({
            client: thirdwebClient,
            label,
        });
        return serverWallet;

    }
}

export default WalletService