import { createThirdwebClient } from "thirdweb";



export const thirdwebClient = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY || "",
});
