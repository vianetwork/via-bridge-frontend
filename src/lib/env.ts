import { z } from "zod";
import { BitcoinNetwork } from "@/services/bitcoin/types";

const schema = z.object({
    NEXT_PUBLIC_NETWORK: z.nativeEnum(BitcoinNetwork),
});

export const env = () => {
    const parsed = schema.safeParse({
        NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
    });

    if (!parsed.success) {
        throw new Error("Invalid client env: " + JSON.stringify(parsed.error.format(), null, 2));
    }

    return parsed.data;
};
