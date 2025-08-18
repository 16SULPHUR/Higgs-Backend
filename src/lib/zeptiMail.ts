import { SendMailClient } from "zeptomail";

const url = process.env.ZEPTOMAIL_URL as string; 
const token = process.env.ZEPTOMAIL_TOKEN as string; 

if (!url) {
  throw new Error("Missing ZEPTOMAIL_URL in environment variables");
}
if (!token) {
  throw new Error("Missing ZEPTOMAIL_TOKEN in environment variables");
}

export const zeptoClient = new SendMailClient({ url, token });
