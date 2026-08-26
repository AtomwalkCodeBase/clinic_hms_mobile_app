import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react-native";

/** The shape every Lucide icon component satisfies — what IconBadge/ListRow/etc. accept in place of the old emoji strings. */
export type LucideIcon = ComponentType<LucideProps>;
