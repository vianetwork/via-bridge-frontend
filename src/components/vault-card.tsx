import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import Image from "next/image";

interface VaultCardProps {
    symbol: string;
    name: string;
    icon: string;
    apy?: string;
    tvl?: string;
    isSelected: boolean;
    selectionHint?: string;
    onClick: () => void;
}

export function VaultCard({ symbol, name, icon, apy, tvl, isSelected, selectionHint, onClick }: VaultCardProps) {
    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200 hover:border-primary/50",
                isSelected ? "border-primary bg-primary/5" : "border-border/50"
            )}
            onClick={onClick}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                    <div className="relative h-6 w-6 rounded-full overflow-hidden">
                        <Image
                            src={icon}
                            alt={symbol}
                            fill
                            className="object-cover"
                        />
                    </div>
                    <CardTitle className="text-sm font-medium">
                        {name}
                    </CardTitle>
                </div>
                {selectionHint ? (
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        {selectionHint} <ChevronDown className="h-3 w-3" />
                    </span>
                ) : (
                    isSelected && <Check className="h-4 w-4 text-primary" />
                )}
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-end">
                    <div className="text-2xl font-bold">{symbol}</div>
                    {apy && (
                        <div className="text-right">
                            <div className="text-xs text-muted-foreground">APY</div>
                            <div className="text-sm font-semibold text-green-600">{apy}</div>
                        </div>
                    )}
                </div>
                {tvl && (
                    <div className="mt-2 text-xs text-muted-foreground">
                        TVL: <span className="font-medium text-foreground">{tvl}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
