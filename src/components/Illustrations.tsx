import React from "react";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

/** Spot illustrations in the Aurora palette, for onboarding and empty states. Pure shapes, no images. */

export function BookIllustration({ width = 260 }: { width?: number }) {
  const cells: React.ReactNode[] = [];
  for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) {
    cells.push(<Rect key={`${c}-${r}`} x={66 + c * 28} y={76 + r * 26} width="18" height="16" rx="5" fill={c === 3 && r === 1 ? "#12A877" : "#EAF2EF"} />);
  }
  return (
    <Svg width={width} height={width * 0.73} viewBox="0 0 260 190">
      <Defs>
        <LinearGradient id="ib1" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#0B7D5A" />
          <Stop offset="0.6" stopColor="#12A877" />
          <Stop offset="1" stopColor="#2C8BE0" />
        </LinearGradient>
      </Defs>
      <Circle cx="200" cy="40" r="34" fill="#DCE8FF" />
      <Circle cx="52" cy="150" r="26" fill="#CDEFE1" />
      <Rect x="48" y="30" width="164" height="132" rx="20" fill="#FFFFFF" stroke="#DCE7E3" />
      <Rect x="48" y="30" width="164" height="34" rx="20" fill="url(#ib1)" />
      <Rect x="48" y="50" width="164" height="14" fill="url(#ib1)" />
      <Rect x="78" y="20" width="8" height="22" rx="4" fill="#0E2A23" />
      <Rect x="174" y="20" width="8" height="22" rx="4" fill="#0E2A23" />
      {cells}
      <Circle cx="190" cy="148" r="20" fill="#12A877" />
      <Path d="M181 148l6 6 11-12" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DocsIllustration({ width = 260 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.73} viewBox="0 0 260 190">
      <Circle cx="58" cy="44" r="30" fill="#DCE8FF" />
      <Circle cx="208" cy="150" r="28" fill="#CDEFE1" />
      <Rect x="92" y="34" width="104" height="132" rx="14" fill="#FFFFFF" stroke="#DCE7E3" transform="rotate(8 144 100)" />
      <Rect x="74" y="30" width="104" height="132" rx="14" fill="#FFFFFF" stroke="#DCE7E3" />
      <Rect x="88" y="48" width="56" height="8" rx="4" fill="#12A877" />
      {[0, 1, 2, 3, 4].map((i) => <Rect key={i} x="88" y={68 + i * 14} width={76 - i * 6} height="6" rx="3" fill="#EAF2EF" />)}
      <G stroke="#2C8BE0" strokeWidth="4" fill="none" strokeLinecap="round">
        <Path d="M150 112v-12h12" />
        <Path d="M198 100h12v12" />
        <Path d="M210 146v12h-12" />
        <Path d="M162 158h-12v-12" />
      </G>
      <Rect x="160" y="110" width="40" height="38" rx="6" fill="#DFF3EA" />
      <Path d="M168 130l7 7 12-14" stroke="#0B7D5A" strokeWidth="4" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function ShareIllustration({ width = 260 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.73} viewBox="0 0 260 190">
      <Defs>
        <LinearGradient id="is1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#12A877" />
          <Stop offset="1" stopColor="#2C8BE0" />
        </LinearGradient>
      </Defs>
      <Circle cx="130" cy="96" r="78" fill="#EAF2EF" />
      <Circle cx="130" cy="96" r="58" fill="none" stroke="#CDEFE1" strokeWidth="10" />
      <Path d="M72 96a58 58 0 0 1 58-58" stroke="#12A877" strokeWidth="10" fill="none" strokeLinecap="round" />
      <Path d="M130 50l36 13v28c0 24-16 38-36 44-20-6-36-20-36-44V63z" fill="url(#is1)" />
      <Rect x="116" y="88" width="28" height="22" rx="5" fill="#FFFFFF" />
      <Path d="M122 88v-6a8 8 0 0 1 16 0v6" stroke="#FFFFFF" strokeWidth="4" fill="none" />
      <SvgText x="208" y="46" fontSize="16" fontWeight="700" fill="#0B7D5A">2h</SvgText>
    </Svg>
  );
}

export function EmptyIllustration({ width = 120 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 120 90">
      <Ellipse cx="60" cy="80" rx="40" ry="6" fill="#EAF2EF" />
      <Rect x="30" y="14" width="60" height="60" rx="14" fill="#FFFFFF" stroke="#DCE7E3" />
      <Rect x="40" y="28" width="30" height="6" rx="3" fill="#CDEFE1" />
      <Rect x="40" y="40" width="40" height="5" rx="2.5" fill="#EAF2EF" />
      <Rect x="40" y="50" width="34" height="5" rx="2.5" fill="#EAF2EF" />
      <Circle cx="88" cy="20" r="10" fill="#12A877" />
      <Path d="M84 20h8M88 16v8" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}
