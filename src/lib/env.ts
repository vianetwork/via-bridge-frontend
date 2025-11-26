import { z } from "zod";
import { BitcoinNetwork } from "@/services/bitcoin/types";

const schema = z.object({
    NEXT_PUBLIC_NETWORK: z.nativeEnum(BitcoinNetwork),
    NEXT_PUBLIC_ENABLE_FAUCET: z.preprocess(
        (val) => val === "true" || val === true,
        z.boolean(),
    ),
    NEXT_PUBLIC_API_URL: z.string().url(),
});

export const env = () => {
    const parsed = schema.safeParse({
        NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
        NEXT_PUBLIC_ENABLE_FAUCET: process.env.NEXT_PUBLIC_ENABLE_FAUCET,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    });

    if (!parsed.success) {
        throw new Error("Invalid client env: " + JSON.stringify(parsed.error.format(), null, 2));
    }

    return parsed.data;
};
