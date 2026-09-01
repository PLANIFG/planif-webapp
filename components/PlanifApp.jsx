"use client";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Sparkles, Plus, Trash2, RefreshCw, Loader2, ChevronRight, ChevronLeft,
  MapPin, Users, Wallet, ShoppingBag, Check, X, Pencil, Printer,
  LayoutGrid, Eye, CalendarDays, GripVertical
} from "lucide-react";

// ---------- Design tokens ----------
const COLORS = {
  paper: "#FBF8F2",
  moss: "#7C9070",
  mossDark: "#54634A",
  sun: "#7C9070",
  ink: "#2B2A26",
  sage: "#E4EEE4",
  danger: "#C4523A",
  marine: "#54634A",
};
const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700&display=swap";

const DEFAULT_LIEUX = ["Gymnase", "Cuisine", "Labo créatif", "Cour intérieure"];
const AGES = ["4-6 ans", "7-9 ans", "10-12 ans"];
const MATERNELLE_AGES = ["4 ans", "5 ans"];

// When all three age groups are selected together, the activities should
// work as ONE shared multi-age activity (not something tailored to a
// single group) — this line is inserted into the prompt in that case.
function agesInstruction(ages) {
  if (ages && ages.length === AGES.length && AGES.every((a) => ages.includes(a))) {
    return "\nIMPORTANT : les 3 groupes d'âge sont sélectionnés ensemble — le groupe est donc MULTI-ÂGE (4-12 ans réunis). Conçois des activités qui fonctionnent bien pour toutes ces tranches d'âge EN MÊME TEMPS (rôles ou niveaux de difficulté adaptables au sein d'une même activité), pas des activités pensées pour un seul groupe d'âge à la fois.\n";
  }
  return "";
}

let uid = 0;
const nextId = () => `id_${++uid}_${Math.random().toString(36).slice(2, 7)}`;
const toggle = (arr, val) => (arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

const DEFAULT_GROUPS = ["Groupe A", "Groupe B", "Groupe C"];

// Unified, ordered schedule: each row is one of:
//  - type "fixe"     -> same label for every group (accueil, collation, extérieur…)
//  - type "rotation" -> filled automatically from the kept activities
//  - type "diner"    -> one label per group (maisonnées)
function fullDayRows() {
  return [
    { id: "pedagogique-1", time: "7 h 00 – 8 h 30", type: "fixe", label: "Accueil, jeux extérieurs ou libres" },
    { id: "pedagogique-2", time: "8 h 30 – 9 h 00", type: "fixe", label: "Collation" },
    { id: "pedagogique-3", time: "9 h 00 – 10 h 00", type: "rotation" },
    { id: "pedagogique-4", time: "10 h 00 – 11 h 00", type: "rotation" },
    { id: "pedagogique-5", time: "11 h 00 – 12 h 00", type: "fixe", label: "Extérieur" },
    { id: "pedagogique-6", time: "12 h 00 – 13 h 00", type: "diner", labels: ["Dîner - Maisonnée 1", "Dîner - Maisonnée 2", "Dîner - Maisonnée 3"] },
    { id: "pedagogique-7", time: "13 h 00 – 14 h 00", type: "rotation" },
    { id: "pedagogique-8", time: "14 h 00 – 14 h 30", type: "fixe", label: "Collation" },
    { id: "pedagogique-9", time: "15 h 00 – 17 h 30", type: "fixe", label: "Jeux extérieurs" },
  ];
}
function concertationRows() {
  return [
    { id: "concertation-1", time: "13 h 00 – 14 h 00", type: "rotation" },
    { id: "concertation-2", time: "14 h 00 – 15 h 00", type: "rotation" },
    { id: "concertation-3", time: "15 h 00 – 15 h 30", type: "fixe", label: "Collation" },
    { id: "concertation-4", time: "15 h 30 – 17 h 30", type: "fixe", label: "Jeux extérieurs" },
  ];
}
function mercrediMaternelleRows(activitesParJour = 1) {
  const rotationRows =
    activitesParJour >= 2
      ? [
          { id: "mercredi-r1", time: "13 h 30 – 14 h 00", type: "rotation" },
          { id: "mercredi-r2", time: "14 h 00 – 14 h 30", type: "rotation" },
        ]
      : [{ id: "mercredi-r1", time: "13 h 30 – 14 h 30", type: "rotation" }];
  return [
    { id: "mercredi-1", time: "13 h 00 – 13 h 30", type: "fixe", label: "Accueil, détente / retour au calme" },
    ...rotationRows,
    { id: "mercredi-2", time: "14 h 30 – 15 h 00", type: "fixe", label: "Collation" },
    { id: "mercredi-3", time: "15 h 00 – 17 h 30", type: "fixe", label: "Jeux extérieurs" },
  ];
}

const DAY_TYPES = [
  { key: "semaine", label: "Planification hebdomadaire", build: null },
  { key: "pedagogique", label: "Journée pédagogique", build: fullDayRows },
  { key: "concertation", label: "Après-midi de concertation", build: concertationRows },
  { key: "mercredi", label: "Mercredi après-midi — maternelle", build: mercrediMaternelleRows },
];

const DOMAINES = ["Physique et moteur", "Social", "Affectif", "Cognitif", "Langagier"];

// ---------- Fiches de transition: coloriage + mots cachés ----------
// Small built-in library of simple line-art shapes (stroke only, no fill)
// so coloring pages are always valid, clean SVG regardless of what the
// AI picks — the AI only chooses WHICH of these fit the theme.
const COLORING_SHAPES = {
  soleil: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="100" cy="95" r="32" />
      <path d="M86 90 Q89 85 92 90 M108 90 Q111 85 114 90" />
      <path d="M84 105 Q100 118 116 105" />
      <path d="M78 78 Q84 82 80 88 M122 78 Q116 82 120 88" strokeWidth="1.3" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        const long = i % 2 === 0;
        const r1 = 40, r2 = long ? 72 : 56;
        return <line key={i} x1={100 + Math.cos(a) * r1} y1={95 + Math.sin(a) * r1} x2={100 + Math.cos(a) * r2} y2={95 + Math.sin(a) * r2} />;
      })}
      <circle cx="35" cy="150" r="14" strokeWidth="1.5" /><circle cx="55" cy="158" r="10" strokeWidth="1.5" />
      <path d="M12 172 Q35 168 58 172" strokeWidth="1.5" />
      <circle cx="165" cy="145" r="12" strokeWidth="1.5" /><circle cx="182" cy="155" r="8" strokeWidth="1.5" />
      <path d="M0 185 h200" strokeWidth="1.3" />
      <path d="M20 185 q4 -10 8 0 M60 185 q4 -10 8 0 M140 185 q4 -10 8 0 M175 185 q4 -10 8 0" strokeWidth="1.2" />
    </g>
  ),
  nuage: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="60" cy="110" r="22" /><circle cx="88" cy="82" r="28" /><circle cx="122" cy="95" r="24" /><circle cx="150" cy="112" r="19" />
      <path d="M38 116 Q38 138 60 138 L153 138 Q173 138 171 116" />
      <path d="M55 100 Q60 96 66 100 M95 72 Q100 68 106 72 M130 88 Q135 84 140 88" strokeWidth="1.3" />
      <path d="M20 150 l6 12 M40 158 l6 14 M65 150 l6 12 M130 155 l6 13 M150 148 l6 12 M170 158 l6 13" strokeWidth="1.5" />
      <circle cx="15" cy="60" r="3" /><circle cx="180" cy="55" r="3" /><circle cx="30" cy="40" r="2" /><circle cx="165" cy="35" r="2" />
      <path d="M170 40 h10 M175 35 v10" strokeWidth="1.2" />
    </g>
  ),
  arbre: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M90 178 L94 128 M110 178 L106 128 M100 178 V122" />
      <path d="M92 150 h16 M90 165 h20" strokeWidth="1.3" />
      <path d="M100 178 Q78 184 60 180 M100 178 Q122 184 140 180" />
      <circle cx="76" cy="82" r="34" /><circle cx="124" cy="76" r="38" /><circle cx="100" cy="50" r="32" />
      <path d="M64 78 q9 -7 16 0 M110 70 q9 -7 16 0 M88 46 q7 -7 14 0 M60 100 q9 -7 16 0 M130 95 q9 -7 16 0" strokeWidth="1.3" />
      <circle cx="55" cy="120" r="6" strokeWidth="1.3" /><circle cx="150" cy="115" r="6" strokeWidth="1.3" />
      <path d="M15 178 q30 -20 45 0 M140 178 q30 -20 45 0" strokeWidth="1.3" />
      <path d="M0 178 h200" strokeWidth="1.3" />
      <path d="M20 178 q3 -8 6 0 M35 178 q3 -8 6 0 M160 178 q3 -8 6 0 M175 178 q3 -8 6 0" strokeWidth="1.2" />
      <path d="M165 55 l4 8 l8 2 l-8 2 l-4 8 l-4 -8 l-8 -2 l8 -2 Z" strokeWidth="1.3" />
    </g>
  ),
  fleur: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M100 118 Q88 150 100 185 Q112 150 100 118" />
      <path d="M100 138 Q78 143 66 158 M100 155 Q122 160 134 174" strokeWidth="1.6" />
      <path d="M66 158 Q60 150 64 142 M134 174 Q140 168 138 160" strokeWidth="1.3" />
      <circle cx="100" cy="85" r="14" />
      <path d="M92 85 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M108 85 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M100 93 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M100 76 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const cx = 100 + Math.cos(a) * 29, cy = 85 + Math.sin(a) * 29;
        return (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="17" ry="10" transform={`rotate(${(a * 180) / Math.PI} ${cx} ${cy})`} />
            <line x1={100 + Math.cos(a) * 16} y1={85 + Math.sin(a) * 16} x2={100 + Math.cos(a) * 42} y2={85 + Math.sin(a) * 42} strokeWidth="1.3" />
          </g>
        );
      })}
      <circle cx="145" cy="60" r="9" strokeWidth="1.5" />
      <path d="M137 60 h16 M145 52 v16" strokeWidth="1.2" />
      <path d="M154 65 q10 4 8 14" strokeWidth="1.3" />
      <path d="M0 185 h200" strokeWidth="1.3" />
      <path d="M30 185 q3 -9 7 0 M55 185 q3 -9 7 0 M150 185 q3 -9 7 0" strokeWidth="1.2" />
    </g>
  ),
  etoile: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <polygon points="100,18 119,71 176,71 130,105 148,160 100,127 52,160 70,105 24,71 81,71" />
      <path d="M100 42 L109 67 L100 82 L91 67 Z" strokeWidth="1.5" />
      <path d="M100 90 L106 105 L100 116 L94 105 Z" strokeWidth="1.3" />
      <line x1="30" y1="30" x2="42" y2="42" /><line x1="170" y1="30" x2="158" y2="42" />
      <path d="M25 55 h10 M25 50 v10" strokeWidth="1.3" /><path d="M175 90 h10 M180 85 v10" strokeWidth="1.3" />
      <circle cx="20" cy="120" r="3" /><circle cx="180" cy="120" r="3" /><circle cx="60" cy="15" r="2" /><circle cx="140" cy="15" r="2" />
      <path d="M20 120 L52 160 M180 120 L148 160" strokeWidth="1" strokeDasharray="2 4" />
    </g>
  ),
  coeur: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M100 172 C36 122 16 80 44 54 C65 33 96 42 100 72 C104 42 135 33 156 54 C184 80 164 122 100 172 Z" />
      <path d="M100 158 C58 122 42 92 52 70 C66 82 88 98 100 128 C112 98 134 82 148 70 C158 92 142 122 100 158 Z" strokeWidth="1.4" />
      {Array.from({ length: 6 }).map((_, i) => (
        <circle key={i} cx={68 + i * 13} cy={60 + (i % 2) * 10} r="2.3" />
      ))}
      <path d="M40 70 q-14 4 -14 18 M160 70 q14 4 14 18" strokeWidth="1.3" />
      <circle cx="26" cy="95" r="2.5" /><circle cx="174" cy="95" r="2.5" />
    </g>
  ),
  papillon: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M100 52 Q92 40 84 34 M100 52 Q108 40 116 34" />
      <circle cx="84" cy="33" r="2.5" /><circle cx="116" cy="33" r="2.5" />
      <path d="M97 55 q3 4 6 0 v92 q-3 4 -6 0 Z" />
      <path d="M96 62 q-3 22 0 36 M104 62 q3 22 0 36 M96 105 q-3 14 0 24 M104 105 q3 14 0 24" strokeWidth="1.3" />
      <ellipse cx="66" cy="80" rx="36" ry="27" /><ellipse cx="134" cy="80" rx="36" ry="27" />
      <ellipse cx="70" cy="126" rx="27" ry="20" /><ellipse cx="130" cy="126" rx="27" ry="20" />
      <ellipse cx="60" cy="78" rx="18" ry="12" strokeWidth="1.4" /><ellipse cx="140" cy="78" rx="18" ry="12" strokeWidth="1.4" />
      <circle cx="48" cy="80" r="6" strokeWidth="1.4" /><circle cx="152" cy="80" r="6" strokeWidth="1.4" />
      <circle cx="66" cy="124" r="5" strokeWidth="1.4" /><circle cx="134" cy="124" r="5" strokeWidth="1.4" />
      <path d="M30 62 q-8 4 -10 14 M170 62 q8 4 10 14" strokeWidth="1.3" />
    </g>
  ),
  feuille: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M100 22 C158 54 160 132 100 184 C40 132 42 54 100 22 Z" />
      <line x1="100" y1="36" x2="100" y2="174" />
      <path d="M100 55 Q125 64 138 80 M100 82 Q126 90 142 108 M100 108 Q124 117 136 132 M100 132 Q120 140 128 152" strokeWidth="1.4" />
      <path d="M100 55 Q75 64 62 80 M100 82 Q74 90 58 108 M100 108 Q76 117 64 132 M100 132 Q80 140 72 152" strokeWidth="1.4" />
      <path d="M117 62 l4 6 M120 90 l4 6 M118 116 l4 6" strokeWidth="1" />
      <path d="M83 62 l-4 6 M80 90 l-4 6 M82 116 l-4 6" strokeWidth="1" />
      <circle cx="25" cy="40" r="2.5" /><circle cx="175" cy="45" r="2.5" />
    </g>
  ),
  maison: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="48" y="98" width="104" height="80" />
      <polygon points="36,98 100,44 164,98" />
      <path d="M46 98 L100 52 L154 98 M40 98 L100 46 L160 98" strokeWidth="1.3" />
      <rect x="86" y="130" width="28" height="48" /><circle cx="105" cy="155" r="2" />
      <path d="M86 154 h28" strokeWidth="1.3" />
      <rect x="58" y="110" width="24" height="24" /><line x1="70" y1="110" x2="70" y2="134" /><line x1="58" y1="122" x2="82" y2="122" />
      <rect x="118" y="110" width="24" height="24" /><line x1="130" y1="110" x2="130" y2="134" /><line x1="118" y1="122" x2="142" y2="122" />
      <path d="M55 108 h30 M115 108 h30" strokeWidth="1.2" />
      <rect x="130" y="55" width="13" height="26" />
      <path d="M136 55 q7 -10 -2 -20 q-8 9 1 18 q-8 6 1 12" strokeWidth="1.4" />
      <circle cx="30" cy="42" r="13" strokeWidth="1.6" />
      <path d="M20 178 q30 -16 55 0 q30 -16 55 0" strokeWidth="1.3" />
      <path d="M15 178 h20 M155 178 h20" strokeWidth="1.6" />
      <path d="M0 178 h200" strokeWidth="1.4" />
    </g>
  ),
  lune: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M115 32 A70 70 0 1 0 115 168 A54 54 0 1 1 115 32 Z" />
      <path d="M55 55 Q60 62 55 68 M40 92 Q45 99 40 105 M50 128 Q55 135 50 141" strokeWidth="1.4" />
      <polygon points="150,45 154,56 166,56 156,63 160,74 150,67 140,74 144,63 134,56 146,56" />
      <polygon points="172,95 175,102 183,102 176,107 179,114 172,110 165,114 168,107 161,102 169,102" strokeWidth="1.4" />
      <circle cx="165" cy="140" r="3" /><circle cx="130" cy="155" r="2.5" /><circle cx="30" cy="130" r="2.5" /><circle cx="25" cy="30" r="2" /><circle cx="185" cy="60" r="2" />
      <circle cx="160" cy="170" r="16" strokeWidth="1.4" /><circle cx="178" cy="176" r="10" strokeWidth="1.4" />
      <path d="M140 178 Q160 186 190 178" strokeWidth="1.4" />
    </g>
  ),
  ballon: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="68" cy="68" r="32" /><circle cx="128" cy="60" r="25" /><circle cx="102" cy="102" r="28" />
      <polygon points="62,98 76,98 68,110" /><polygon points="121,83 137,83 129,95" /><polygon points="95,128 111,128 102,140" />
      <path d="M68 110 Q55 132 64 152 M129 95 Q140 116 122 135 Q130 142 116 155 M102 140 Q110 158 96 175" strokeWidth="1.5" />
      <path d="M58 58 q6 -8 14 -4 M117 52 q5 -6 12 -3 M92 94 q6 -8 14 -4" strokeWidth="1.3" />
      <path d="M50 78 q-4 8 4 14 M148 66 q6 6 2 14 M76 118 q-4 8 4 12" strokeWidth="1.2" />
      <path d="M0 178 h200" strokeWidth="1.3" />
      <path d="M20 178 v-10 M35 178 v-14 M160 178 v-10 M175 178 v-14" strokeWidth="1.2" />
    </g>
  ),
  poisson: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="92" cy="98" rx="56" ry="32" />
      <polygon points="146,98 182,70 182,126" />
      <path d="M97 68 Q105 80 97 92 M112 70 Q120 82 112 96 M97 102 Q105 114 97 127 M82 106 Q90 118 82 130" strokeWidth="1.5" />
      <path d="M68 76 Q78 88 68 98 Q78 108 68 120" strokeWidth="1.4" />
      <circle cx="58" cy="90" r="4" fill="#11223A" />
      <path d="M92 70 Q88 62 92 55 M92 126 Q88 134 92 141" strokeWidth="1.4" />
      <path d="M15 55 q6 8 0 16 M8 95 q6 8 0 16 M18 130 q6 8 0 16" strokeWidth="1.3" />
      <path d="M160 150 Q168 130 160 112 M175 155 Q183 135 175 115" strokeWidth="1.3" />
      <ellipse cx="20" cy="160" rx="12" ry="6" strokeWidth="1.3" /><ellipse cx="45" cy="168" rx="16" ry="7" strokeWidth="1.3" />
    </g>
  ),
  arcenciel: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round">
      <path d="M15 165 A85 85 0 0 1 185 165" />
      <path d="M33 165 A67 67 0 0 1 167 165" />
      <path d="M51 165 A49 49 0 0 1 149 165" />
      <path d="M69 165 A31 31 0 0 1 131 165" />
      <path d="M87 165 A13 13 0 0 1 113 165" strokeWidth="1.4" />
      <circle cx="30" cy="172" r="12" /><circle cx="48" cy="180" r="8" /><circle cx="15" cy="182" r="6" strokeWidth="1.4" />
      <circle cx="170" cy="172" r="12" /><circle cx="152" cy="180" r="8" /><circle cx="185" cy="182" r="6" strokeWidth="1.4" />
      <circle cx="20" cy="30" r="3" /><circle cx="180" cy="25" r="3" /><circle cx="100" cy="15" r="2.5" />
      <path d="M10 45 h8 M182 40 h8" strokeWidth="1.3" />
    </g>
  ),
  fusee: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M100 20 C132 52 132 112 118 148 L82 148 C68 112 68 52 100 20 Z" />
      <circle cx="100" cy="78" r="17" /><circle cx="100" cy="78" r="9" strokeWidth="1.4" />
      <path d="M84 100 h32 M84 112 h32" strokeWidth="1.3" />
      <path d="M82 128 L52 155 L58 164 M118 128 L148 155 L142 164" />
      <path d="M86 148 L78 182 L100 170 L122 182 L114 148" />
      <path d="M92 182 q8 8 16 0" strokeWidth="1.4" />
      <path d="M38 60 h12 M155 42 h12 M172 88 h10 M25 105 h8" strokeWidth="1.4" />
      <circle cx="28" cy="95" r="3" /><circle cx="168" cy="118" r="3" />
      <circle cx="45" cy="140" r="9" strokeWidth="1.4" /><path d="M38 140 h14 M45 133 v14" strokeWidth="1" />
      <path d="M150 60 l4 8 l8 2 l-8 2 l-4 8 l-4 -8 l-8 -2 l8 -2 Z" strokeWidth="1.4" />
    </g>
  ),
  chateau: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="52" y="88" width="96" height="90" />
      <path d="M52 108 h96 M52 128 h96 M52 148 h96" strokeWidth="1.2" strokeDasharray="10 4" />
      <rect x="36" y="58" width="30" height="120" /><polygon points="36,58 51,36 66,58" />
      <rect x="134" y="58" width="30" height="120" /><polygon points="134,58 149,36 164,58" />
      <path d="M52 88 h96 M58 88 v-14 h8 v14 M78 88 v-14 h8 v14 M98 88 v-14 h8 v14 M118 88 v-14 h8 v14 M138 88 v-14 h8 v14" />
      <path d="M90 178 v-40 a10 10 0 0 1 20 0 v40" />
      <rect x="86" y="112" width="28" height="22" strokeWidth="1.5" /><line x1="100" y1="112" x2="100" y2="134" strokeWidth="1.2" />
      <rect x="42" y="100" width="14" height="18" strokeWidth="1.4" /><rect x="144" y="100" width="14" height="18" strokeWidth="1.4" />
      <line x1="51" y1="40" x2="51" y2="22" /><path d="M51 22 l16 6 l-16 6 Z" />
      <line x1="149" y1="40" x2="149" y2="22" /><path d="M149 22 l16 6 l-16 6 Z" />
      <path d="M20 178 q80 -14 160 0" strokeWidth="1.3" />
    </g>
  ),
  cactus: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M90 178 V90 a10 10 0 0 1 20 0 v88" />
      <path d="M90 128 Q58 128 58 102 Q58 84 77 84" />
      <path d="M110 112 Q142 112 142 88 Q142 70 125 70" />
      <path d="M95 55 q3 -14 8 0 M103 55 q3 -14 8 0" strokeWidth="1.4" />
      <path d="M83 100 v55 M100 96 v70 M117 106 v60" strokeWidth="1.2" />
      <path d="M60 105 v18 M70 90 v18 M120 88 v18 M132 74 v18" strokeWidth="1" />
      <ellipse cx="58" cy="178" rx="14" ry="7" strokeWidth="1.5" /><ellipse cx="145" cy="178" rx="10" ry="5" strokeWidth="1.5" /><ellipse cx="30" cy="178" rx="10" ry="5" strokeWidth="1.5" />
      <path d="M0 178 h200" strokeWidth="1.3" />
      <circle cx="170" cy="40" r="18" strokeWidth="1.4" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={170 + Math.cos(a) * 22} y1={40 + Math.sin(a) * 22} x2={170 + Math.cos(a) * 30} y2={40 + Math.sin(a) * 30} strokeWidth="1.2" />;
      })}
    </g>
  ),
  oiseau: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="100" cy="103" rx="40" ry="30" />
      <path d="M75 90 Q80 85 88 88 M78 100 Q84 96 92 99 M80 112 Q86 109 94 112" strokeWidth="1.3" />
      <circle cx="148" cy="78" r="21" />
      <polygon points="167,76 186,81 167,89" />
      <circle cx="155" cy="72" r="2.5" fill="#11223A" />
      <path d="M148 60 q4 -8 10 -6" strokeWidth="1.4" />
      <path d="M62 95 Q35 88 20 102 Q40 108 60 108 M62 105 Q30 108 18 125 Q42 120 65 115" />
      <path d="M85 132 Q78 150 64 156 M100 135 Q100 152 100 160 M118 132 Q126 150 138 156" strokeWidth="1.4" />
      <path d="M10 172 Q60 148 120 172 Q160 152 195 170" strokeWidth="1.4" />
      <path d="M40 172 v-20 M40 152 q-14 -4 -18 -18 M40 152 q14 -4 18 -18" strokeWidth="1.3" />
    </g>
  ),
  escargot: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M118 152 A42 42 0 1 1 160 110 A27 27 0 1 1 133 137 A14 14 0 1 1 119 123 A7 7 0 1 1 126 116" />
      <path d="M118 152 Q58 152 42 130 Q26 110 42 96 Q58 87 74 101 Q88 115 74 128 Q63 137 52 128" strokeWidth="1.4" />
      <path d="M42 96 Q30 68 18 50 M56 94 Q52 66 60 47" />
      <circle cx="18" cy="48" r="4.5" /><circle cx="60" cy="45" r="4.5" />
      <path d="M0 172 h200" strokeWidth="1.3" />
      <path d="M30 172 q80 -12 150 0" strokeWidth="1.2" />
      <path d="M150 172 Q160 155 155 140 M170 172 Q182 158 178 142" strokeWidth="1.3" />
    </g>
  ),
  champignon: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M35 92 Q35 40 100 40 Q165 40 165 92 Q100 110 35 92 Z" />
      <path d="M35 92 Q100 106 165 92" strokeWidth="1.3" />
      <circle cx="62" cy="65" r="7" /><circle cx="100" cy="55" r="6" /><circle cx="136" cy="70" r="7" /><circle cx="100" cy="82" r="5" /><circle cx="75" cy="85" r="4" /><circle cx="122" cy="88" r="4" />
      <path d="M75 100 L75 178 Q100 186 125 178 L125 100" />
      <path d="M82 118 Q100 126 118 118 M82 140 Q100 148 118 140 M82 160 Q100 168 118 160" strokeWidth="1.3" />
      <circle cx="152" cy="130" r="16" strokeWidth="1.4" /><circle cx="146" cy="122" r="3" /><circle cx="158" cy="135" r="2.5" />
      <path d="M152 146 v20" strokeWidth="1.4" />
      <path d="M0 178 h200" strokeWidth="1.3" />
      <path d="M15 178 q3 -8 6 0 M25 178 q3 -8 6 0" strokeWidth="1.1" />
    </g>
  ),
  coquillage: (
    <g stroke="#11223A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M100 178 Q36 172 36 108 Q36 50 100 24 Q164 50 164 108 Q164 172 100 178 Z" />
      <path d="M100 178 V24 M74 174 Q62 96 78 28 M48 158 Q45 92 62 40 M126 174 Q138 96 122 28 M152 158 Q155 92 138 40" strokeWidth="1.5" />
      <path d="M22 178 Q100 200 178 178" strokeWidth="1.4" />
      <path d="M15 165 q80 20 170 0" strokeWidth="1.2" strokeDasharray="6 5" />
      <polygon points="30,150 34,160 44,160 36,166 39,176 30,170 21,176 24,166 16,160 26,160" strokeWidth="1.4" />
      <circle cx="170" cy="140" r="3" /><circle cx="178" cy="155" r="2.5" />
    </g>
  ),
};
const COLORING_SHAPE_NAMES = Object.keys(COLORING_SHAPES);

// Matches AI-returned shape names against our library tolerantly (case,
// accents, surrounding text), so a near-miss like "Fleur" or "papillons"
// still resolves. Falls back to a default assortment if nothing matches
// at all, so the coloring page is never silently empty.
function normalizeFormes(rawFormes) {
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const known = COLORING_SHAPE_NAMES.map((n) => ({ name: n, norm: norm(n) }));
  const matched = [];
  (Array.isArray(rawFormes) ? rawFormes : []).forEach((f) => {
    const nf = norm(f);
    const hit = known.find((k) => nf === k.norm || nf.includes(k.norm) || k.norm.includes(nf));
    if (hit && !matched.includes(hit.name)) matched.push(hit.name);
  });
  if (matched.length > 0) return matched.slice(0, 4);
  // Fallback: a pleasant default assortment so something always prints.
  return ["soleil", "fleur", "papillon", "nuage"];
}

function ColoringPrintPage({ formes, theme, customImages }) {
  const shapes = (formes || []).filter((f) => COLORING_SHAPES[f]).slice(0, 4);
  const images = customImages || [];
  if (images.length === 0 && shapes.length === 0) return null;

  if (images.length > 0) {
    return (
      <>
        {images.map((img, i) => (
          <div key={i} className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Fiche de transition {images.length > 1 ? `(${i + 1}/${images.length})` : ""}</p>
            <h2 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Coloriage — {theme || "à colorier"}</h2>
            <div className="leaf-underline w-16 mt-3 mb-6" />
            <div className="flex items-center justify-center">
              <img src={img} alt="Coloriage" className="max-w-full max-h-[600px] rounded-xl border border-[#E3DACB]" />
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Fiche de transition</p>
      <h2 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Coloriage — {theme || "à colorier"}</h2>
      <div className="leaf-underline w-16 mt-3 mb-6" />
      <div className="grid grid-cols-2 gap-6">
        {shapes.map((name) => (
          <div key={name} className="border border-[#E3DACB] rounded-xl p-4 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-auto max-w-[220px]">{COLORING_SHAPES[name]}</svg>
          </div>
        ))}
      </div>
    </div>
  );
}

function WordSearchPrintPage({ wordSearch, theme }) {
  if (!wordSearch || !wordSearch.grid) return null;
  return (
    <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Fiche de transition</p>
      <h2 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Mots cachés — {theme || ""}</h2>
      <div className="leaf-underline w-16 mt-3 mb-6" />
      <table className="border-collapse mx-auto mb-6">
        <tbody>
          {wordSearch.grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((letter, ci) => (
                <td key={ci} className="border border-[#DCD3C2] text-center font-mono font-semibold" style={{ width: 26, height: 26, fontSize: 14 }}>{letter}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>Mots à trouver</h3>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {wordSearch.placed.map((w, i) => <span key={i}>{w}</span>)}
      </div>
    </div>
  );
}

// ---------- Matériel détecté automatiquement (bingo) ----------
// Repère si une activité mentionne "bingo" dans son nom, sans distinction
// d'accents/majuscules (ex. "Bingo des aliments", "BINGO nature").
function activiteNecessiteBingo(nom) {
  const norm = String(nom || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return norm.includes("bingo");
}

function buildBingoPrompt({ theme, nomActivite }) {
  return `Tu prépares une carte de bingo imprimable pour une activité de service de garde en milieu scolaire.

Activité : "${nomActivite}"
Thème de la journée : "${theme || "non précisé"}"

Propose exactement 24 mots ou courtes expressions (1 à 2 mots chacun, en français, sans accents ni ponctuation) en lien avec cette activité et ce thème, adaptés à des enfants du primaire — assez variés et concrets pour remplir une grille de bingo 5x5 (la case centrale sera une case "gratuite").

Réponds UNIQUEMENT avec un tableau JSON valide de 24 chaînes, sans texte avant/après, format exact :
["Mot1", "Mot2", "Mot3", ...]`;
}

function BingoPrintPage({ nomActivite, theme, mots }) {
  if (!mots || mots.length < 24) return null;
  const grille = [...mots.slice(0, 12), "GRATUIT", ...mots.slice(12, 24)];
  const lettres = ["B", "I", "N", "G", "O"];
  return (
    <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Matériel — bingo</p>
      <h2 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>{nomActivite}</h2>
      <div className="leaf-underline w-16 mt-3 mb-6" />
      <div className="grid grid-cols-5 gap-2 max-w-[480px] mx-auto">
        {lettres.map((l) => (
          <div key={l} className="text-center font-bold text-white rounded-lg py-2" style={{ background: COLORS.moss, fontFamily: "Baloo 2, sans-serif", fontSize: 20 }}>{l}</div>
        ))}
        {grille.map((mot, i) => (
          <div
            key={i}
            className="aspect-square border border-[#E3DACB] rounded-lg flex items-center justify-center text-center px-1"
            style={mot === "GRATUIT" ? { background: COLORS.sage, color: COLORS.mossDark, fontFamily: "Baloo 2, sans-serif", fontWeight: 700, fontSize: 12 } : { fontSize: 11.5, fontWeight: 600 }}
          >
            {mot}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildTransitionPrompt({ theme }) {
  return `Tu prépares des fiches d'activités de transition (à imprimer) pour des enfants en service de garde, sur le thème "${theme}".

1. Choisis 4 formes DANS CETTE LISTE EXACTE (aucune autre valeur permise) qui conviennent le mieux au thème, pour une page à colorier simple intégrée à l'app : ${COLORING_SHAPE_NAMES.join(", ")}.
2. Propose 8 mots courts (4 à 9 lettres, en MAJUSCULES, sans accents ni espaces) liés au thème, pour un jeu de mots cachés adapté à des enfants du primaire.
3. Écris 3 courtes descriptions (en français, une phrase chacune) de scènes à colorier liées au thème, à utiliser comme prompts dans un générateur d'images IA externe (ex. "un renard curieux explorant une forêt d'automne avec des feuilles qui tombent"). Varie les sujets.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, format exact :
{
  "formes": ["soleil", "fleur", "papillon", "nuage"],
  "mots": ["SOLEIL", "FLEUR", "PAPILLON", "NUAGE", "ETE", "JARDIN", "ABEILLE", "VERT"],
  "imagePrompts": ["Description de scène 1", "Description de scène 2", "Description de scène 3"]
}`;
}

// Classic word-search grid generator: places each word in a random
// direction/position (allowing overlaps on matching letters), then fills
// remaining cells with random letters.
function buildWordSearch(words, size = 12) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];
  const placed = [];
  let cleanWords = (Array.isArray(words) ? words : []).map((w) => String(w).toUpperCase().replace(/[^A-ZÀ-Ÿ]/g, "")).filter((w) => w.length >= 3 && w.length <= size);
  if (cleanWords.length === 0) {
    cleanWords = ["SOLEIL", "NATURE", "AMI", "JOUR", "ETE", "JEU"];
  }

  cleanWords.forEach((word) => {
    let ok = false;
    for (let attempt = 0; attempt < 60 && !ok; attempt++) {
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      const maxRow = dy >= 0 ? size - (word.length - 1) * Math.abs(dy) : size;
      const startRowMin = dy < 0 ? (word.length - 1) * Math.abs(dy) : 0;
      const maxCol = dx >= 0 ? size - (word.length - 1) * Math.abs(dx) : size;
      const startColMin = dx < 0 ? (word.length - 1) * Math.abs(dx) : 0;
      if (maxRow <= startRowMin || maxCol <= startColMin) continue;
      const row = startRowMin + Math.floor(Math.random() * (maxRow - startRowMin));
      const col = startColMin + Math.floor(Math.random() * (maxCol - startColMin));
      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const r = row + dy * i, c = col + dx * i;
        if (r < 0 || r >= size || c < 0 || c >= size) { fits = false; break; }
        const existing = grid[r][c];
        if (existing !== null && existing !== word[i]) { fits = false; break; }
      }
      if (!fits) continue;
      for (let i = 0; i < word.length; i++) {
        const r = row + dy * i, c = col + dx * i;
        grid[r][c] = word[i];
      }
      placed.push(word);
      ok = true;
    }
  });

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return { grid, placed };
}

const DEFAULT_SCHEDULE_ROWS = fullDayRows();

const MOIS_NOMS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function getWednesdaysInMonth(year, monthIndex) {
  const dates = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    if (d.getDay() === 3) dates.push(d);
  }
  return dates;
}

function formatDateFr(date) {
  return `${date.getDate()} ${MOIS_NOMS[date.getMonth()].toLowerCase()}`;
}

// ---------- Claude call ----------
// Appelle notre propre route backend sécurisée (/api/generate) au lieu
// d'appeler Anthropic directement — la vraie clé API ne quitte jamais le
// serveur. C'est le changement essentiel par rapport à l'artefact Claude.
async function askClaudeOnce(promptText, maxTokens) {
  let response;
  try {
    response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText, maxTokens }),
    });
  } catch (e) {
    throw new Error(`[appel réseau] ${e.name || "Error"}: ${e.message}`);
  }
  let bodyText;
  try {
    bodyText = await response.text();
  } catch (e) {
    throw new Error(`[lecture texte] ${e.name || "Error"}: ${e.message}`);
  }
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (e) {
    const preview = bodyText.length ? bodyText.slice(0, 100).replace(/\s+/g, " ") : "(réponse vide)";
    throw new Error(`[réponse non-JSON, ${bodyText.length} car.] "${preview}"`);
  }
  if (!response.ok) {
    const err = new Error(data?.error || `Erreur réseau/API (${response.status})`);
    err.status = response.status;
    throw err;
  }
  const text = data.text || "";
  try {
    return extractJson(text);
  } catch (e) {
    throw new Error(`[extraction] ${e.message}`);
  }
}

// Retries once on a parsing/format failure (transient formatting hiccups
// from the model), mais jamais sur une erreur HTTP (réseau, panne serveur,
// ou quota dépassé) — celles-là échouent immédiatement.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Message clair pour l'interface : quand c'est un quota dépassé (429), le
// message vient déjà du serveur, prêt à afficher — pas besoin de le préfixer
// avec "La génération a échoué", ce qui sonnerait comme un bug plutôt qu'une
// limite normale.
function friendlyGenerationError(e, fallbackPrefix = "La génération a échoué") {
  if (e?.status === 429) return e.message;
  return `${fallbackPrefix} : ${e?.message || "erreur inconnue"}`;
}

async function askClaude(promptText, maxTokens = 3000) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(900 * attempt);
    try {
      return await askClaudeOnce(promptText, maxTokens);
    } catch (e) {
      lastErr = e;
      if (e.status) throw e;
    }
  }
  throw lastErr;
}

// Same robust fetch/read path as askClaudeOnce, but returns raw trimmed
// text instead of parsing JSON — used for short free-text generations
// like an "amorce" (activity intro/hook), where JSON would be overkill.
async function askClaudeTextOnce(promptText, maxTokens) {
  let response;
  try {
    response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText, maxTokens }),
    });
  } catch (e) {
    throw new Error(`[appel réseau] ${e.name || "Error"}: ${e.message}`);
  }
  let bodyText;
  try {
    bodyText = await response.text();
  } catch (e) {
    throw new Error(`[lecture texte] ${e.name || "Error"}: ${e.message}`);
  }
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (e) {
    const preview = bodyText.length ? bodyText.slice(0, 100).replace(/\s+/g, " ") : "(réponse vide)";
    throw new Error(`[réponse non-JSON, ${bodyText.length} car.] "${preview}"`);
  }
  if (!response.ok) {
    const err = new Error(data?.error || `Erreur réseau/API (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return (data.text || "").trim();
}
async function askClaudeText(promptText, maxTokens = 400) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(900 * attempt);
    try {
      return await askClaudeTextOnce(promptText, maxTokens);
    } catch (e) {
      lastErr = e;
      if (e.status) throw e;
    }
  }
  throw lastErr;
}

function buildAmorcePrompt({ nom, age, lieu, deroulement }) {
  return `Tu es éducateur/éducatrice en service de garde en milieu scolaire. Tu dois animer l'activité suivante avec un groupe d'enfants et tu veux une courte amorce pour bien la présenter et capter leur attention.

Activité : "${nom}"
Groupe d'âge : ${age || "non précisé"}
Lieu : ${lieu || "non précisé"}
Déroulement : ${(deroulement || []).join(" / ") || "non précisé"}

Écris une amorce de 3 à 5 phrases, à dire directement aux enfants (tutoiement ou "on"), qui capte leur attention et introduit le thème ou le but de l'activité de façon vivante (question, mise en situation, petite histoire courte, etc.). Évite les formules génériques comme "Aujourd'hui on va faire une activité".

Réponds UNIQUEMENT avec le texte de l'amorce, sans titre, sans guillemets, sans texte avant/après.`;
}

// Tolerant JSON extraction: strips code fences, then walks bracket depth
// (ignoring brackets inside quoted strings) to find the TRUE matching
// close bracket, instead of grabbing the last one in the whole response.
function extractJson(rawText) {
  let clean = rawText.replace(/```json|```/g, "").trim();
  const firstArray = clean.indexOf("[");
  const firstObject = clean.indexOf("{");
  let start = -1, openChar = "[", closeChar = "]";
  if (firstArray !== -1 && (firstObject === -1 || firstArray < firstObject)) { start = firstArray; openChar = "["; closeChar = "]"; }
  else if (firstObject !== -1) { start = firstObject; openChar = "{"; closeChar = "}"; }
  if (start === -1) throw new Error("Réponse vide ou invalide — réessayez.");

  let depth = 0, inString = false, escaped = false, end = -1;
  for (let i = start; i < clean.length; i++) {
    const c = clean[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error("Réponse tronquée — réessayez.");

  const candidate = clean.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    throw new Error(`format inattendu — réessayez (${candidate.slice(0, 60).replace(/\s+/g, " ")}…)`);
  }
}

function buildBatchPrompt({ theme, ages, lieux, count, monthContext }) {
  const cadreMensuel = monthContext
    ? monthContext.activitesParJour > 1
      ? `\nCONTEXTE PARTICULIER : ces activités sont pour les mercredis après-midi de maternelle du mois de ${monthContext.mois} ${monthContext.annee} (${monthContext.nbSemaines} mercredis ce mois-ci, ${monthContext.activitesParJour} activités par mercredi). Les idées doivent être générées PAR GROUPES DE ${monthContext.activitesParJour} DANS L'ORDRE : les ${monthContext.activitesParJour} premières idées sont pour le 1er mercredi, les ${monthContext.activitesParJour} suivantes pour le 2e mercredi, et ainsi de suite. Au sein d'un même mercredi, varie le type d'activité (ex. une active et une calme). Varie bien les activités d'un mercredi à l'autre.\n`
      : `\nCONTEXTE PARTICULIER : ces activités sont pour les mercredis après-midi de maternelle du mois de ${monthContext.mois} ${monthContext.annee} (${monthContext.nbSemaines} mercredis ce mois-ci). Chaque idée correspond à UN mercredi différent — varie bien les activités d'une semaine à l'autre.\n`
    : "";
  const contrainteDuree = monthContext
    ? `chaque activité doit durer 30 MINUTES MAXIMUM (c'est le temps alloué par bloc de rotation). N'excède jamais 30 minutes.`
    : `chaque activité doit durer 60 minutes MAXIMUM (idéalement 30 à 60 minutes). N'excède jamais 60 minutes.`;
  return `Tu conçois des activités pour des journées pédagogiques et après-midis de concertation en milieu scolaire (élèves du primaire présents au service de garde).

Thème de la journée : "${theme}"
Groupes d'âge visés : ${ages.length ? ages.join(", ") : "4-12 ans, tous groupes"}
Lieux disponibles : ${lieux.length ? lieux.join(", ") : "à déterminer"}
${cadreMensuel}${agesInstruction(ages)}
Propose ${count} idées d'activités DIFFÉRENTES et concrètes, réalisables avec un groupe d'enfants, en lien avec le thème.
IMPORTANT : ${contrainteDuree}
Pour chaque activité, écris aussi une courte amorce (3 à 5 phrases, à dire directement aux enfants) pour capter leur attention et introduire l'activité de façon vivante — évite les formules génériques comme "Aujourd'hui on va faire une activité".

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant/après, sans balises markdown, au format exact suivant :
[
  {
    "nom": "Nom court de l'activité",
    "lieu": "Un des lieux fournis",
    "age": "Groupe d'âge le plus adapté",
    "duree": "Durée estimée (ex. 45-60 minutes)",
    "amorce": "Courte amorce à dire aux enfants",
    "deroulement": ["Étape 1", "Étape 2", "Étape 3", "Étape 4"],
    "materiel": ["Item 1", "Item 2", "Item 3"]
  }
]`;
}

function buildSinglePrompt({ theme, ages, lieux, avoidNames, isMercredi, lieuAssigne }) {
  return `Tu conçois des activités pour des journées pédagogiques en milieu scolaire (élèves du primaire).

Thème : "${theme}"
Groupes d'âge : ${ages.length ? ages.join(", ") : "4-12 ans"}
${lieuAssigne ? `Lieu à utiliser pour CETTE activité : "${lieuAssigne}" — n'utilise aucun autre lieu, l'activité doit être pensée spécifiquement pour cet endroit.` : `Lieux disponibles : ${lieux.length ? lieux.join(", ") : "à déterminer"}`}
${agesInstruction(ages)}
Propose UNE nouvelle idée d'activité, différente de celles-ci : ${avoidNames.join(", ") || "aucune"}.
IMPORTANT : ${isMercredi ? "l'activité doit durer 30 MINUTES MAXIMUM (c'est le temps alloué par bloc de rotation)." : "l'activité doit durer 60 minutes MAXIMUM (idéalement 30 à 60 minutes)."}
Écris aussi une courte amorce (3 à 5 phrases, à dire directement aux enfants) pour capter leur attention et introduire l'activité de façon vivante.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, format exact :
{
  "nom": "Nom court",
  "lieu": "${lieuAssigne ? lieuAssigne : "Un des lieux fournis"}",
  "age": "Groupe d'âge",
  "duree": "Durée estimée",
  "amorce": "Courte amorce à dire aux enfants",
  "deroulement": ["Étape 1", "Étape 2", "Étape 3", "Étape 4"],
  "materiel": ["Item 1", "Item 2"]
}`;
}

// Ops for the unified, ordered schedule rows list
function useScheduleOps(setRows, groups) {
  const addFixe = () => setRows((cur) => [...cur, { id: nextId(), time: "", type: "fixe", label: "" }]);
  const addRotation = () => setRows((cur) => [...cur, { id: nextId(), time: "", type: "rotation" }]);
  const addDiner = () =>
    setRows((cur) => [...cur, { id: nextId(), time: "", type: "diner", labels: groups.map(() => "") }]);
  const remove = (id) => setRows((cur) => cur.filter((r) => r.id !== id));
  const update = (id, patch) => setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const updateLabelAt = (id, groupIdx, val) =>
    setRows((cur) =>
      cur.map((r) => {
        if (r.id !== id) return r;
        const labels = [...(r.labels || [])];
        while (labels.length <= groupIdx) labels.push("");
        labels[groupIdx] = val;
        return { ...r, labels };
      })
    );
  const move = (id, dir) =>
    setRows((cur) => {
      const idx = cur.findIndex((r) => r.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  // Déplace le bloc `draggedId` juste avant le bloc `targetId` — utilisé par
  // le glisser-déposer dans l'Horaire.
  const reorder = (draggedId, targetId) =>
    setRows((cur) => {
      if (draggedId === targetId) return cur;
      const draggedIdx = cur.findIndex((r) => r.id === draggedId);
      if (draggedIdx === -1) return cur;
      const next = [...cur];
      const [item] = next.splice(draggedIdx, 1);
      const targetIdx = next.findIndex((r) => r.id === targetId);
      if (targetIdx === -1) { next.splice(draggedIdx, 0, item); return next; }
      next.splice(targetIdx, 0, item);
      return next;
    });
  return { addFixe, addRotation, addDiner, remove, update, updateLabelAt, move, reorder };
}

// ---------- small atoms ----------
function TextField({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-white border border-[#DCD3C2] rounded-lg px-3 py-2 text-[15px] text-[#2B2A26] placeholder-[#B3A990] focus:outline-none focus:ring-2 focus:ring-[#7C9070] focus:border-transparent ${className}`}
    />
  );
}
function Chip({ active, onClick, children, activeColor, activeTextColor }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
        active ? "border-transparent" : "text-[#7A7362] border-[#DCD3C2] bg-white hover:border-[#7C9070]"
      } ${active && !activeTextColor ? "text-white" : ""}`}
      style={active ? { background: activeColor || COLORS.moss, color: activeTextColor } : {}}
    >
      {children}
    </button>
  );
}
function SectionCard({ children, className = "" }) {
  return (
    <div className={`bg-white/70 border border-[#E3DACB] rounded-2xl p-5 ${className}`} style={{ boxShadow: "0 1px 2px rgba(43,42,38,0.04)" }}>
      {children}
    </div>
  );
}
function IconBtn({ onClick, title, children, danger }) {
  return (
    <button onClick={onClick} title={title} className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${danger ? "hover:bg-[#F2EEE4] text-[#7A7362] hover:text-[#10192B]" : "hover:bg-[#E4EEE4] text-[#7C9070]"}`}>
      {children}
    </button>
  );
}

// ================= APP =================
export default function App() {
  const [tab, setTab] = useState("idees"); // idees | horaire | apercu
  // Remonte la page en haut à chaque changement d'onglet (idées / horaire /
  // aperçu) — sans ça, la nouvelle vue apparaissait là où le défilement
  // était resté, donc parfois presque tout en bas de l'écran.
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  const [showBiblio, setShowBiblio] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [showBiblio]);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);

  // ---- generator state ----
  const [theme, setTheme] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [ages, setAges] = useState(["4-6 ans", "7-9 ans", "10-12 ans"]);
  const [lieuxOptions, setLieuxOptions] = useState(DEFAULT_LIEUX);
  const [lieux, setLieux] = useState(["Gymnase", "Cuisine", "Labo créatif"]);
  const addLieuOption = (name) => {
    const clean = name.trim();
    if (!clean || lieuxOptions.includes(clean)) return;
    setLieuxOptions((cur) => [...cur, clean]);
    setLieux((cur) => [...cur, clean]);
  };
  const renameLieuOption = (oldName, newName) => {
    const clean = newName.trim();
    if (!clean) return;
    setLieuxOptions((cur) => cur.map((l) => (l === oldName ? clean : l)));
    setLieux((cur) => cur.map((l) => (l === oldName ? clean : l)));
  };
  const removeLieuOption = (name) => {
    setLieuxOptions((cur) => cur.filter((l) => l !== name));
    setLieux((cur) => cur.filter((l) => l !== name));
  };
  const [count, setCount] = useState(4);
  const [ideas, setIdeas] = useState([]);
  const [kept, setKept] = useState([]);
  const [loading, setLoading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  // ---- schedule state ----
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [scheduleRows, setScheduleRows] = useState(DEFAULT_SCHEDULE_ROWS);
  const scheduleOps = useScheduleOps(setScheduleRows, groups);

  // ---- sauvegarde automatique (lieux, groupes, thème) liée au compte ----
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        if (data.lieux?.length) { setLieux(data.lieux); setLieuxOptions((cur) => Array.from(new Set([...cur, ...data.lieux]))); }
        if (data.groupes?.length) setGroups(data.groupes);
        if (data.theme_par_defaut) setTheme(data.theme_par_defaut);
      }
      setSettingsLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return; // évite d'écraser les données au premier rendu
    const timeout = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("user_settings").upsert({
        user_id: user.id,
        lieux, groupes: groups, theme_par_defaut: theme,
        updated_at: new Date().toISOString(),
      });
    }, 1200); // sauvegarde 1,2 s après la dernière modification
    return () => clearTimeout(timeout);
  }, [lieux, groups, theme, settingsLoaded]);
  const [dayType, setDayType] = useState("semaine");
  useEffect(() => { window.scrollTo(0, 0); }, [dayType]);
  const [activitesParMercredi, setActivitesParMercredi] = useState(1);
  const applyDayType = (key) => {
    const found = DAY_TYPES.find((d) => d.key === key);
    if (!found) return;
    setDayType(key);
    if (found.build) setScheduleRows(key === "mercredi" ? found.build(activitesParMercredi) : found.build());
    setAges(key === "mercredi" ? [...MATERNELLE_AGES] : [...AGES]);
    // Chaque mode (journée pédagogique, concertation, mercredi maternelle) doit
    // repartir à neuf — sans ça, les idées générées dans un mode réapparaissaient
    // dans les autres, puisqu'elles partageaient le même espace de mémoire.
    setIdeas([]);
    setKept([]);
    setEditingId(null);
    setError("");
    setTab("idees");
    setTransitionEnabled(false);
    setTransitionData(null);
    setTransitionError("");
    setTransitionImages([]);
  };

  const now = new Date();
  const [moisIndex, setMoisIndex] = useState(now.getMonth());
  const [anneeMois, setAnneeMois] = useState(now.getFullYear());
  const mercredis = useMemo(() => getWednesdaysInMonth(anneeMois, moisIndex), [anneeMois, moisIndex]);

  // ---- fiches de transition (coloriage + mots cachés) ----
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [transitionData, setTransitionData] = useState(null); // { formes, wordSearch }
  const [loadingTransition, setLoadingTransition] = useState(false);
  const [transitionError, setTransitionError] = useState("");
  const [transitionImages, setTransitionImages] = useState([]);
  const handleTransitionImageUpload = (files) => {
    const list = Array.from(files || []);
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => setTransitionImages((cur) => [...cur, e.target.result]);
      reader.readAsDataURL(file);
    });
  };
  const removeTransitionImage = (idx) => setTransitionImages((cur) => cur.filter((_, i) => i !== idx));
  const generateTransition = async () => {
    setLoadingTransition(true);
    setTransitionError("");
    try {
      const raw = await askClaude(buildTransitionPrompt({ theme }));
      const formes = normalizeFormes(raw.formes);
      const mots = Array.isArray(raw.mots) ? raw.mots : [];
      const imagePrompts = Array.isArray(raw.imagePrompts) ? raw.imagePrompts.filter(Boolean) : [];
      setTransitionData({ formes, wordSearch: buildWordSearch(mots), imagePrompts });
      setTransitionForTheme(theme);
    } catch (e) {
      setTransitionError(friendlyGenerationError(e, "Échec de la génération"));
    } finally {
      setLoadingTransition(false);
    }
  };
  // Génération automatique dès que la case est cochée (ou que le thème
  // change ensuite) — plus besoin de cliquer sur un bouton. Se déclenche
  // uniquement dans le navigateur (useEffect), jamais pendant le rendu
  // initial, donc sans risque d'incohérence serveur/client.
  const [transitionForTheme, setTransitionForTheme] = useState(null);
  const transitionEnCours = useRef(false);
  useEffect(() => {
    if (!transitionEnabled || !theme.trim()) return;
    if (transitionForTheme === theme) return;
    if (transitionEnCours.current) return;
    transitionEnCours.current = true;
    generateTransition().finally(() => { transitionEnCours.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionEnabled, theme]);
  const isMercredi = dayType === "mercredi";
  const effectiveCount = isMercredi ? Math.max(mercredis.length, 1) * activitesParMercredi : count;

  useEffect(() => {
    if (isMercredi) setScheduleRows(mercrediMaternelleRows(activitesParMercredi));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitesParMercredi]);

  const generateBatch = async () => {
    setLoading(true);
    setError("");
    try {
      // Génère une activité à la fois plutôt qu'un seul gros appel qui demande
      // tout d'un coup — chaque requête individuelle reste bien sous la limite
      // de 10 secondes de Netlify, contrairement à une requête unique qui
      // demande plusieurs activités détaillées en même temps et peut dépasser
      // cette limite (erreur "Inactivity Timeout"). S'applique aussi au mode
      // mercredi maternelle : l'ordre de génération correspond à l'ordre des
      // mercredis (le regroupement par date se fait à l'affichage, par index).
      const results = [];
      const names = [];
      let echecs = 0;
      for (let i = 0; i < effectiveCount; i++) {
        try {
          const lieuAssigne = lieux.length > 0 ? lieux[i % lieux.length] : undefined;
          const raw = await askClaude(buildSinglePrompt({ theme, ages, lieux, avoidNames: names, isMercredi, lieuAssigne }));
          results.push({ id: nextId(), ...raw });
          names.push(raw.nom);
          setIdeas([...results]); // affiche les idées au fur et à mesure, pas juste à la toute fin
        } catch (e) {
          // Une activité malchanceuse (ex. lenteur ponctuelle du serveur) ne doit
          // pas faire perdre toutes celles déjà générées avec succès — on continue
          // avec les suivantes, et on avertit à la fin combien ont échoué.
          echecs += 1;
        }
      }
      if (echecs > 0) {
        setError(
          `${results.length} idée${results.length > 1 ? "s" : ""} générée${results.length > 1 ? "s" : ""} avec succès. ` +
          `${echecs} idée${echecs > 1 ? "s" : ""} n'${echecs > 1 ? "ont" : "a"} pas pu être générée${echecs > 1 ? "s" : ""} (lenteur ponctuelle). ` +
          `Cliquez « Générer des idées » de nouveau pour compléter, ou continuez avec ce qui a été généré.`
        );
      }
    } catch (e) {
      setError(friendlyGenerationError(e));
    } finally {
      setLoading(false);
    }
  };

  const regenerateOne = async (id) => {
    setRegeneratingId(id);
    setError("");
    try {
      const avoidNames = ideas.map((i) => i.nom);
      const raw = await askClaude(buildSinglePrompt({ theme, ages, lieux, avoidNames, isMercredi }));
      setIdeas((cur) => cur.map((i) => (i.id === id ? { id, ...raw } : i)));
    } catch (e) {
      setError(friendlyGenerationError(e, "La régénération a échoué"));
    } finally {
      setRegeneratingId(null);
    }
  };

  const updateIdea = (id, patch) => setIdeas((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const updateListField = (id, field, idx, val) =>
    setIdeas((cur) => cur.map((i) => (i.id === id ? { ...i, [field]: i[field].map((v, vi) => (vi === idx ? val : v)) } : i)));
  const addListItem = (id, field) => setIdeas((cur) => cur.map((i) => (i.id === id ? { ...i, [field]: [...i[field], ""] } : i)));
  const removeListItem = (id, field, idx) =>
    setIdeas((cur) => cur.map((i) => (i.id === id ? { ...i, [field]: i[field].filter((_, vi) => vi !== idx) } : i)));

  const keepIdea = (id) => {
    const idea = ideas.find((i) => i.id === id);
    if (idea && !kept.find((k) => k.id === id)) setKept((k) => [...k, idea]);
  };
  const unkeepIdea = (id) => setKept((k) => k.filter((i) => i.id !== id));

  // ---- amorce (per-activity intro/hook) ----
  const [generatingAmorceId, setGeneratingAmorceId] = useState(null);
  const generateAmorce = async (id) => {
    const source = ideas.find((i) => i.id === id) || kept.find((i) => i.id === id);
    if (!source) return;
    setGeneratingAmorceId(id);
    try {
      const amorce = await askClaudeText(buildAmorcePrompt({ nom: source.nom, age: source.age, lieu: source.lieu, deroulement: source.deroulement }));
      setIdeas((cur) => cur.map((i) => (i.id === id ? { ...i, amorce } : i)));
      setKept((cur) => cur.map((i) => (i.id === id ? { ...i, amorce } : i)));
    } catch (e) {
      // surface via the idea's own error slot would need more plumbing; keep it simple with an alert-free silent console log fallback
      setIdeas((cur) => cur.map((i) => (i.id === id ? { ...i, amorceError: e.message || "échec" } : i)));
      setKept((cur) => cur.map((i) => (i.id === id ? { ...i, amorceError: e.message || "échec" } : i)));
    } finally {
      setGeneratingAmorceId(null);
    }
  };

  // ---- groups editing ----
  const addGroup = () =>
    setGroups((g) => {
      const next = [...g, `Groupe ${String.fromCharCode(65 + g.length)}`];
      return next;
    });
  const removeGroup = (idx) => setGroups((g) => g.filter((_, i) => i !== idx));
  const renameGroup = (idx, val) => setGroups((g) => g.map((x, i) => (i === idx ? val : x)));

  // ---- rows enriched with rotation cells, computed in chronological order ----
  const computedRows = useMemo(() => {
    const n = kept.length;
    let rotationIdx = 0;
    return scheduleRows.map((row) => {
      if (row.type === "rotation") {
        const cells = n === 0 ? groups.map(() => null) : groups.map((_, gi) => kept[(gi + rotationIdx) % n]);
        rotationIdx += 1;
        return { ...row, cells };
      }
      return row;
    });
  }, [scheduleRows, groups, kept]);

  const materialList = Array.from(new Set(kept.flatMap((i) => i.materiel || [])));

  return (
    <div className="min-h-screen" style={{ background: COLORS.paper, fontFamily: "Nunito, sans-serif", color: COLORS.ink }}>
      <style>{`
        @import url('${FONT_IMPORT_URL}');
        @media print {
          .no-print { display: none !important; }
          .print-page { break-after: page; }
          .print-page:last-child { break-after: auto; }
          .print-shadow-off { box-shadow: none !important; border-color: #ddd !important; }
        }
        .leaf-underline { background: transparent; height: 0; margin: 0 !important; }
      `}</style>

      {/* Top bar — scrolls together with the rest of the page */}
      <div className="no-print" style={{ background: COLORS.paper, borderBottom: "1px solid #E3DACB", borderTop: `3px solid ${COLORS.marine}` }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-bold text-[26px]" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>
            Planificateur d'activités
          </span>
          <div className="relative">
            <button
              onClick={() => setShowTopMenu((v) => !v)}
              className="w-10 h-10 rounded-xl bg-white border border-[#E3DACB] flex items-center justify-center text-xl font-bold"
              style={{ color: COLORS.mossDark }}
              title="Menu"
            >
              ⋯
            </button>
            {showTopMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTopMenu(false)} />
                <div className="absolute right-0 top-12 z-20 bg-white border border-[#E3DACB] rounded-xl shadow-lg py-1.5 w-56">
                  <button
                    onClick={() => { setShowTopMenu(false); setShowBiblio(true); }}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#2B2A26] hover:bg-[#FBF8F2]"
                  >
                    Ma bibliothèque
                  </button>
                  <button
                    onClick={async () => {
                      setShowTopMenu(false);
                      setOpeningPortal(true);
                      try {
                        const res = await fetch("/api/create-portal-session", { method: "POST" });
                        const data = await res.json();
                        if (data.url) window.location.href = data.url;
                        else alert(data.error || "Impossible d'ouvrir la gestion d'abonnement.");
                      } catch (e) {
                        alert("Erreur réseau.");
                      } finally {
                        setOpeningPortal(false);
                      }
                    }}
                    disabled={openingPortal}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#2B2A26] hover:bg-[#FBF8F2] disabled:opacity-50"
                  >
                    {openingPortal ? "..." : "Gérer mon abonnement"}
                  </button>
                  <div className="border-t border-[#EDE6D8] my-1" />
                  <button
                    onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-[#7A7362] hover:bg-[#FBF8F2]"
                  >
                    Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex flex-wrap gap-2">
          {DAY_TYPES.map((d) => (
            <Chip key={d.key} active={dayType === d.key} onClick={() => { setShowBiblio(false); applyDayType(d.key); }}>{d.label}</Chip>
          ))}
        </div>
      </div>

      {showBiblio ? (
        <BibliothequeView onBack={() => setShowBiblio(false)} />
      ) : dayType === "semaine" ? (
        <WeeklyGridTool />
      ) : (
        <>
          {tab === "idees" && (
            <IdeesView
              dayType={dayType} applyDayType={applyDayType}
              isMercredi={isMercredi} moisIndex={moisIndex} setMoisIndex={setMoisIndex}
              anneeMois={anneeMois} setAnneeMois={setAnneeMois} mercredis={mercredis} effectiveCount={effectiveCount}
              activitesParMercredi={activitesParMercredi} setActivitesParMercredi={setActivitesParMercredi}
              theme={theme} setTheme={setTheme} ages={ages} setAges={setAges}
              lieux={lieux} setLieux={setLieux} lieuxOptions={lieuxOptions}
              addLieuOption={addLieuOption} renameLieuOption={renameLieuOption} removeLieuOption={removeLieuOption}
              count={count} setCount={setCount}
              ideas={ideas} kept={kept} loading={loading} regeneratingId={regeneratingId} error={error} editingId={editingId}
              setEditingId={setEditingId} generateBatch={generateBatch} regenerateOne={regenerateOne}
              updateIdea={updateIdea} updateListField={updateListField} addListItem={addListItem} removeListItem={removeListItem}
              keepIdea={keepIdea} unkeepIdea={unkeepIdea}
              transitionEnabled={transitionEnabled} setTransitionEnabled={setTransitionEnabled}
              transitionData={transitionData} loadingTransition={loadingTransition} transitionError={transitionError}
              generateTransition={generateTransition}
              generateAmorce={generateAmorce} generatingAmorceId={generatingAmorceId}
              transitionImages={transitionImages} onTransitionImageUpload={handleTransitionImageUpload} onRemoveTransitionImage={removeTransitionImage}
              onContinue={() => setTab("horaire")}
            />
          )}

          {tab === "horaire" && (
            <HoraireView
              dateLabel={dateLabel} setDateLabel={setDateLabel}
              groups={groups} addGroup={addGroup} removeGroup={removeGroup} renameGroup={renameGroup}
              scheduleRows={scheduleRows} scheduleOps={scheduleOps}
              kept={kept}
              onBack={() => setTab("idees")}
              onContinue={() => setTab("apercu")}
            />
          )}

          {tab === "apercu" && (
            <PrintView
              theme={theme} dateLabel={dateLabel} groups={groups}
              computedRows={computedRows} kept={kept}
              materialList={materialList}
              isMercredi={isMercredi} mercredis={mercredis} activitesParMercredi={activitesParMercredi}
              transitionEnabled={transitionEnabled} transitionData={transitionData} transitionImages={transitionImages}
              onBack={() => setTab("horaire")}
            />
          )}
        </>
      )}


      {/* Logo PLANIF, tourné, fixé en bas à gauche */}
      <div className="no-print" style={{ position: "fixed", left: 8, bottom: "calc(45px + env(safe-area-inset-bottom))", width: 60, height: 130, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "visible", zIndex: 2147483647, pointerEvents: "none", WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}>
        <img src="/planif-logo-vert-sauge.png" alt="PLANIF" style={{ height: 34, width: 111, objectFit: "contain", display: "block", transform: "rotate(90deg)", transformOrigin: "center center" }} />
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${active ? "bg-white shadow-sm text-[#2B2A26]" : "text-[#7A7362]"}`}>
      <Icon size={14} /> {children}
    </button>
  );
}

// ================= IDÉES TAB =================
function IdeesView(props) {
  const {
    dayType, applyDayType, isMercredi, moisIndex, setMoisIndex, anneeMois, setAnneeMois, mercredis, effectiveCount,
    activitesParMercredi, setActivitesParMercredi,
    theme, setTheme, ages, setAges, lieux, setLieux, lieuxOptions, addLieuOption, renameLieuOption, removeLieuOption,
    count, setCount,
    ideas, kept, loading, regeneratingId, error, editingId, setEditingId,
    generateBatch, regenerateOne, updateIdea, updateListField, addListItem, removeListItem,
    keepIdea, unkeepIdea, onContinue,
    transitionEnabled, setTransitionEnabled, transitionData, loadingTransition, transitionError, generateTransition,
    generateAmorce, generatingAmorceId,
    transitionImages, onTransitionImageUpload, onRemoveTransitionImage,
  } = props;

  const [newLieu, setNewLieu] = useState("");
  const [editingLieu, setEditingLieu] = useState(null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>
          {DAY_TYPES.find((d) => d.key === dayType)?.label || "Planification d'activités"}
        </h1>
        <p className="text-[#7A7362] mt-1 max-w-2xl">
          Précisez le thème, les groupes d'âge et les lieux disponibles. Générez, ajustez,
          puis gardez les activités qui composeront la journée.
        </p>
      </div>

      <SectionCard>
        <div className="mb-4">
          <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Thème de la journée</label>
          <div className="mt-1 max-w-sm"><TextField value={theme} onChange={setTheme} placeholder="Ex. Éveil de la nature" /></div>
        </div>

        <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide flex items-center gap-1.5"><Users size={13} /> Groupes d'âge</label>
        <div className="flex flex-wrap gap-2 mt-2 mb-4">
          {(isMercredi ? MATERNELLE_AGES : AGES).map((a) => <Chip key={a} active={ages.includes(a)} onClick={() => setAges((c) => toggle(c, a))}>{a}</Chip>)}
        </div>

        <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide flex items-center gap-1.5"><MapPin size={13} /> Lieux disponibles</label>
        <div className="flex flex-wrap gap-2 mt-2 items-center">
          {lieuxOptions.map((l) =>
            editingLieu === l ? (
              <div key={l} className="flex items-center gap-1">
                <input
                  autoFocus
                  defaultValue={l}
                  onBlur={(e) => { renameLieuOption(l, e.target.value); setEditingLieu(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { renameLieuOption(l, e.target.value); setEditingLieu(null); }
                    if (e.key === "Escape") setEditingLieu(null);
                  }}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold border border-[#7C9070] bg-white w-32"
                />
              </div>
            ) : (
              <div key={l} className="group relative">
                <Chip
                  active={lieux.includes(l)}
                  onClick={() => setLieux((c) => toggle(c, l))}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {l}
                    <Pencil
                      size={11}
                      onClick={(e) => { e.stopPropagation(); setEditingLieu(l); }}
                      className="opacity-50 hover:opacity-100"
                    />
                    <X
                      size={12}
                      onClick={(e) => { e.stopPropagation(); removeLieuOption(l); }}
                      className="opacity-50 hover:opacity-100 hover:text-red-500"
                    />
                  </span>
                </Chip>
              </div>
            )
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <TextField
            value={newLieu}
            onChange={setNewLieu}
            placeholder="Ajouter un lieu (ex. Bibliothèque)"
            className="max-w-[220px]"
          />
          <button
            onClick={() => { addLieuOption(newLieu); setNewLieu(""); }}
            disabled={!newLieu.trim()}
            className="flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-lg disabled:opacity-40"
            style={{ background: COLORS.moss }}
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <div className="mb-2" />

        {isMercredi ? (
          <div className="mb-5 mt-4">
            <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Mois à planifier</label>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <select
                value={moisIndex}
                onChange={(e) => setMoisIndex(Number(e.target.value))}
                className="bg-white border border-[#DCD3C2] rounded-lg px-3 py-2 text-[15px] text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#7C9070]"
              >
                {MOIS_NOMS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <input
                type="number"
                value={anneeMois}
                onChange={(e) => setAnneeMois(Number(e.target.value) || anneeMois)}
                className="bg-white border border-[#DCD3C2] rounded-lg px-3 py-2 text-[15px] text-[#2B2A26] w-24 focus:outline-none focus:ring-2 focus:ring-[#7C9070]"
              />
            </div>

            <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide mt-4 block">Nombre d'activités par après-midi</label>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2].map((n) => (
                <Chip key={n} active={activitesParMercredi === n} onClick={() => setActivitesParMercredi(n)}>{n}</Chip>
              ))}
            </div>

            <p className="text-xs text-[#7A7362] mt-2">
              {mercredis.length} mercredi{mercredis.length > 1 ? "s" : ""} en {MOIS_NOMS[moisIndex].toLowerCase()} {anneeMois}
              {mercredis.length ? ` (${mercredis.map(formatDateFr).join(", ")})` : ""} — {effectiveCount} idée{effectiveCount > 1 ? "s" : ""} seront générées ({activitesParMercredi} par mercredi).
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-5 mt-4">
            <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Nombre d'idées</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => <Chip key={n} active={count === n} onClick={() => setCount(n)}>{n}</Chip>)}
            </div>
          </div>
        )}

        <button onClick={generateBatch} disabled={loading || !theme.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold disabled:opacity-50" style={{ background: COLORS.moss }}>
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Génération en cours…" : "Générer des idées"}
        </button>
        {error && <p className="text-sm mt-2" style={{ color: COLORS.danger }}>{error}</p>}
      </SectionCard>

      {ideas.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Idées proposées</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id} idea={idea} isKept={!!kept.find((k) => k.id === idea.id)}
                isEditing={editingId === idea.id} isRegenerating={regeneratingId === idea.id}
                onEdit={() => setEditingId(editingId === idea.id ? null : idea.id)}
                onKeep={() => keepIdea(idea.id)} onUnkeep={() => unkeepIdea(idea.id)}
                onRegenerate={() => regenerateOne(idea.id)} onUpdate={(patch) => updateIdea(idea.id, patch)}
                onUpdateListField={(field, idx, val) => updateListField(idea.id, field, idx, val)}
                onAddListItem={(field) => addListItem(idea.id, field)}
                onRemoveListItem={(field, idx) => removeListItem(idea.id, field, idx)}
                onGenerateAmorce={() => generateAmorce(idea.id)}
                isGeneratingAmorce={generatingAmorceId === idea.id}
              />
            ))}
          </div>
        </div>
      )}

      {kept.length > 0 && (
        <SectionCard>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>
            <Check size={18} className="text-[#7C9070]" /> Retenues pour la journée ({kept.length})
          </h2>
          <ul className="space-y-1.5 mb-2">
            {kept.map((i) => (
              <li key={i.id} className="flex items-center justify-between text-sm bg-white rounded-lg border border-[#E3DACB] px-3 py-2">
                <span><strong>{i.nom}</strong> — {i.lieu} · {i.age}</span>
                <button onClick={() => unkeepIdea(i.id)} className="text-[#B3A990] hover:text-red-500"><X size={14} /></button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard>
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={transitionEnabled}
            onChange={(e) => setTransitionEnabled(e.target.checked)}
            className="w-4 h-4 rounded accent-[#7C9070]"
          />
          <span className="font-semibold" style={{ fontFamily: "Baloo 2, sans-serif" }}>Fiches de transition <span className="font-normal text-xs text-[#7A7362]">(coloriages et mots cachés)</span></span>
        </label>
        {transitionEnabled && (
          <div className="mt-3 ml-6">
            {loadingTransition && (
              <p className="text-sm text-[#7A7362] flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Génération en cours…</p>
            )}
            {transitionError && <p className="text-sm mt-2" style={{ color: COLORS.danger }}>{transitionError}</p>}
            {transitionData && !transitionError && (
              <div className="mt-3 p-3 rounded-lg border border-[#E3DACB] bg-white">
                <p className="text-xs font-bold text-[#7C9070] mb-2">✓ Prêtes — s'ajouteront à l'aperçu</p>
                <p className="text-xs text-[#7A7362] mb-2">Mots cachés et coloriage.</p>
                {transitionData.imagePrompts?.length > 0 && (
                  <div className="pt-2 border-t border-[#EDE6D8]">
                    <p className="text-xs font-bold text-[#7A7362] mb-1">Pour un vrai coloriage illustré :</p>
                    <p className="text-xs text-[#7A7362] mb-2">Sur educol.net, entrez une description du dessin voulu (ex. « un renard curieux dans une forêt d'automne ») pour obtenir un coloriage prêt à imprimer.</p>
                    {transitionData.imagePrompts.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#FBF3E4] rounded px-2 py-1 mt-1">
                        <p className="text-xs text-[#2B2A26] italic flex-1">« {p} »</p>
                        <button onClick={() => navigator.clipboard.writeText(p)} className="text-[10px] font-bold text-[#7C9070] bg-white border border-[#DCD3C2] rounded px-2 py-1 shrink-0">Copier</button>
                      </div>
                    ))}
                    <a href="https://educol.net" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: COLORS.moss }}>
                      Ouvrir educol.net ↗
                    </a>
                    <div className="mt-2">
                      <label className="text-xs font-semibold text-[#7C9070] cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCD3C2] hover:border-[#7C9070]">
                        <Sparkles size={12} /> Importer une ou plusieurs images
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onTransitionImageUpload(e.target.files)} />
                      </label>
                      {transitionImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {transitionImages.map((img, i) => (
                            <div key={i} className="relative">
                              <img src={img} alt="" className="w-14 h-14 object-cover rounded-lg border border-[#DCD3C2]" />
                              <button onClick={() => onRemoveTransitionImage(i)} className="absolute -top-1.5 -right-1.5 bg-white border border-[#DCD3C2] rounded-full w-5 h-5 flex items-center justify-center text-[#B3A990] hover:text-red-500">
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <div className="flex justify-end pb-6">
        <button onClick={onContinue} disabled={kept.length === 0} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold disabled:opacity-40" style={{ background: COLORS.moss }}>
          Passer à l'horaire <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function IdeaCard({ idea, isKept, isEditing, isRegenerating, onEdit, onKeep, onUnkeep, onRegenerate, onUpdate, onUpdateListField, onAddListItem, onRemoveListItem, onGenerateAmorce, isGeneratingAmorce }) {
  return (
    <div className="bg-white border border-[#E3DACB] rounded-2xl p-4 flex flex-col" style={{ boxShadow: "0 1px 2px rgba(43,42,38,0.04)" }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        {isEditing ? <TextField value={idea.nom} onChange={(v) => onUpdate({ nom: v })} className="font-semibold" /> : (
          <h3 className="font-bold text-[#2B2A26]" style={{ fontFamily: "Baloo 2, sans-serif" }}>{idea.nom}</h3>
        )}
        <button onClick={onEdit} className="shrink-0 text-[#B3A990] hover:text-[#7C9070]" title="Modifier"><Pencil size={15} /></button>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#7A7362] mb-3">
        <span className="flex items-center gap-1"><MapPin size={12} />{idea.lieu}</span>
        <span className="flex items-center gap-1"><Users size={12} />{idea.age}</span>
        <span>{idea.duree}</span>
      </div>

      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7A7362] mb-1">Amorce</p>
        {idea.amorce ? (
          isEditing ? (
            <textarea value={idea.amorce} onChange={(e) => onUpdate({ amorce: e.target.value })} rows={3} className="w-full bg-white border border-[#DCD3C2] rounded-lg px-2.5 py-1.5 text-sm text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#7C9070]" />
          ) : (
            <p className="text-sm text-[#2B2A26] italic">{idea.amorce}</p>
          )
        ) : (
          <p className="text-xs text-[#B3A990]">{idea.amorceError ? `Échec : ${idea.amorceError}` : "Pas encore générée."}</p>
        )}
      </div>

      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7A7362] mb-1">Déroulement</p>
        <ul className="space-y-1">
          {(idea.deroulement || []).map((line, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span className="text-[#B3A990] mt-0.5">{i + 1}.</span>
              {isEditing ? <TextField value={line} onChange={(v) => onUpdateListField("deroulement", i, v)} /> : <span>{line}</span>}
            </li>
          ))}
        </ul>
        {isEditing && <button onClick={() => onAddListItem("deroulement")} className="mt-1 text-xs font-semibold text-[#7C9070] flex items-center gap-1"><Plus size={12} /> Étape</button>}
      </div>

      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7A7362] mb-1">Matériel</p>
        <ul className="space-y-1">
          {(idea.materiel || []).map((m, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span style={{ color: COLORS.marine }}>•</span>
              {isEditing ? (
                <div className="flex-1 flex items-center gap-1">
                  <TextField value={m} onChange={(v) => onUpdateListField("materiel", i, v)} />
                  <button onClick={() => onRemoveListItem("materiel", i)} className="text-[#B3A990] hover:text-[#10192B]"><Trash2 size={13} /></button>
                </div>
              ) : <span>{m}</span>}
            </li>
          ))}
        </ul>
        {isEditing && <button onClick={() => onAddListItem("materiel")} className="mt-1 text-xs font-semibold text-[#7C9070] flex items-center gap-1"><Plus size={12} /> Item</button>}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-2 border-t border-[#EDE6D8]">
        {isKept ? (
          <button onClick={onUnkeep} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: COLORS.moss }}><Check size={14} /> Retenue</button>
        ) : (
          <button onClick={onKeep} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: COLORS.moss }}><Check size={14} /> Garder</button>
        )}
        <button onClick={onRegenerate} disabled={isRegenerating} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-[#DCD3C2] text-[#7A7362] disabled:opacity-50">
          {isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>
    </div>
  );
}

// ================= HORAIRE TAB =================
function HoraireView({
  dateLabel, setDateLabel, groups, addGroup, removeGroup, renameGroup,
  scheduleRows, scheduleOps, kept, onBack, onContinue,
}) {
  // Glisser-déposer compatible souris ET doigt (événements Pointer, natifs,
  // aucune librairie externe) — on suit le bloc "attrapé" via la poignée,
  // et au relâchement on le déplace juste avant le bloc survolé.
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleGripPointerDown = (rowId) => (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(rowId);
  };
  const handlePointerMove = (e) => {
    if (!draggingId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = el?.closest("[data-row-id]");
    if (rowEl) {
      const id = rowEl.getAttribute("data-row-id");
      if (id !== dragOverId) setDragOverId(id);
    }
  };
  const handlePointerUp = () => {
    if (draggingId && dragOverId && draggingId !== dragOverId) {
      scheduleOps.reorder(draggingId, dragOverId);
    }
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Bâtir l'horaire</h1>
        <p className="text-[#7A7362] mt-1 max-w-2xl">
          Une seule liste, dans l'ordre réel de la journée. Les blocs « Rotation » se remplissent
          automatiquement avec les {kept.length} activité{kept.length > 1 ? "s" : ""} retenue{kept.length > 1 ? "s" : ""}.
          Glissez la poignée ⠿ pour réordonner, modifiez les heures et libellés, ou ajoutez des blocs.
        </p>
      </div>

      <SectionCard>
        <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide flex items-center gap-1.5"><CalendarDays size={13} /> Date ou repère (optionnel)</label>
        <div className="mt-1 max-w-xs"><TextField value={dateLabel} onChange={setDateLabel} placeholder="Ex. 18 mai 2026" /></div>
      </SectionCard>

      <SectionCard>
        <h3 className="font-semibold mb-3" style={{ fontFamily: "Baloo 2, sans-serif" }}>Groupes</h3>
        <div className="space-y-2">
          {groups.map((g, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <TextField value={g} onChange={(v) => renameGroup(idx, v)} />
              <IconBtn danger title="Retirer" onClick={() => removeGroup(idx)}><Trash2 size={15} /></IconBtn>
            </div>
          ))}
        </div>
        <button onClick={addGroup} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[#7C9070] hover:underline"><Plus size={15} /> Ajouter un groupe</button>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ fontFamily: "Baloo 2, sans-serif" }}>Déroulement de la journée</h3>
        </div>

        {kept.length === 0 && (
          <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-[#FBF3E4] text-[#8A6A2B]">
            Aucune activité retenue pour l'instant — les blocs « Rotation » resteront vides. Retournez à l'onglet Idées pour en garder.
          </p>
        )}

        <div className="space-y-2" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
          {scheduleRows.map((row, idx) => (
            <ScheduleRowEditor
              key={row.id}
              row={row}
              groups={groups}
              isFirst={idx === 0}
              isLast={idx === scheduleRows.length - 1}
              ops={scheduleOps}
              isDragging={draggingId === row.id}
              isDragOver={dragOverId === row.id && draggingId !== row.id}
              onGripPointerDown={handleGripPointerDown(row.id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={scheduleOps.addFixe} className="flex items-center gap-1.5 text-sm font-semibold text-[#7C9070] border border-[#DCD3C2] rounded-lg px-3 py-1.5 hover:border-[#7C9070]">
            <Plus size={14} /> Bloc fixe
          </button>
          <button onClick={scheduleOps.addRotation} className="flex items-center gap-1.5 text-sm font-semibold text-[#7C9070] border border-[#DCD3C2] rounded-lg px-3 py-1.5 hover:border-[#7C9070]">
            <Plus size={14} /> Plage de rotation
          </button>
          <button onClick={scheduleOps.addDiner} className="flex items-center gap-1.5 text-sm font-semibold text-[#7C9070] border border-[#DCD3C2] rounded-lg px-3 py-1.5 hover:border-[#7C9070]">
            <Plus size={14} /> Dîner (par groupe)
          </button>
        </div>
      </SectionCard>

      <div className="flex justify-between pb-6">
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[#7A7362] border border-[#DCD3C2]"><ChevronLeft size={16} /> Retour aux idées</button>
        <button onClick={onContinue} disabled={kept.length === 0} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold disabled:opacity-40" style={{ background: COLORS.moss }}>
          Voir l'aperçu imprimable <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const map = {
    fixe: { label: "Fixe", bg: "#EFE9DB", fg: "#7A7362" },
    rotation: { label: "Rotation", bg: "#E4EEE4", fg: COLORS.moss },
    diner: { label: "Dîner", bg: "#FBF3E4", fg: "#8A6A2B" },
  };
  const s = map[type] || map.fixe;
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shrink-0" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

function ScheduleRowEditor({ row, groups, isFirst, isLast, ops, isDragging, isDragOver, onGripPointerDown }) {
  return (
    <div
      data-row-id={row.id}
      className="border rounded-xl p-3 bg-white/60 transition-shadow"
      style={{
        borderColor: isDragOver ? COLORS.moss : "#E3DACB",
        borderWidth: isDragOver ? 2 : 1,
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isDragOver ? "0 0 0 3px rgba(124,144,112,0.15)" : "none",
      }}
    >
      <div className="flex items-start gap-2">
        <div
          onPointerDown={onGripPointerDown}
          className="flex flex-col items-center justify-center pt-1.5 text-[#B3A990] hover:text-[#7C9070] cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
          title="Glisser pour réordonner"
        >
          <GripVertical size={16} />
        </div>
        <div className="flex flex-col gap-1 pt-1">
          <button disabled={isFirst} onClick={() => ops.move(row.id, -1)} className="text-[#B3A990] hover:text-[#7C9070] disabled:opacity-30">
            <ChevronRight size={14} style={{ transform: "rotate(-90deg)" }} />
          </button>
          <button disabled={isLast} onClick={() => ops.move(row.id, 1)} className="text-[#B3A990] hover:text-[#7C9070] disabled:opacity-30">
            <ChevronRight size={14} style={{ transform: "rotate(90deg)" }} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <TypeBadge type={row.type} />
            <TextField value={row.time} onChange={(v) => ops.update(row.id, { time: v })} placeholder="Heure (ex. 9 h 00 – 10 h 00)" className="max-w-[220px]" />
          </div>

          {row.type === "fixe" && (
            <TextField value={row.label} onChange={(v) => ops.update(row.id, { label: v })} placeholder="Libellé (ex. Collation)" />
          )}

          {row.type === "rotation" && (
            <p className="text-sm text-[#B3A990] italic">Se remplit automatiquement avec les activités retenues.</p>
          )}

          {row.type === "diner" && (
            <div className="space-y-1.5">
              {groups.map((g, gi) => (
                <div key={gi} className="flex items-center gap-2">
                  <span className="text-xs text-[#B3A990] w-24 shrink-0 truncate">{g}</span>
                  <TextField
                    value={row.labels?.[gi] || ""}
                    onChange={(v) => ops.updateLabelAt(row.id, gi, v)}
                    placeholder="Ex. Dîner - Maisonnée 1"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <IconBtn danger title="Retirer" onClick={() => ops.remove(row.id)}><Trash2 size={15} /></IconBtn>
      </div>
    </div>
  );
}

// ================= APERÇU / IMPRESSION =================
function PrintView({ theme, dateLabel, groups, computedRows, kept, materialList, isMercredi, mercredis, activitesParMercredi, transitionEnabled, transitionData, transitionImages, onBack }) {
  const [savingBiblio, setSavingBiblio] = useState(false);
  const [biblioSaved, setBiblioSaved] = useState(false);

  // Génération automatique du bingo pour toute activité retenue dont le nom
  // contient "bingo" — sans case à cocher, déclenchée une seule fois par
  // activité, uniquement côté navigateur (dans useEffect, jamais pendant le
  // rendu initial), donc sans risque d'incohérence serveur/client.
  const [bingoMots, setBingoMots] = useState({}); // { [activityId]: string[] }
  const bingoEnCours = useRef({});
  useEffect(() => {
    kept.forEach((activite) => {
      if (!activiteNecessiteBingo(activite.nom)) return;
      if (bingoMots[activite.id] || bingoEnCours.current[activite.id]) return;
      bingoEnCours.current[activite.id] = true;
      askClaude(buildBingoPrompt({ theme, nomActivite: activite.nom }))
        .then((mots) => {
          if (Array.isArray(mots) && mots.length >= 24) {
            setBingoMots((cur) => ({ ...cur, [activite.id]: mots }));
          }
        })
        .catch(() => {})
        .finally(() => { bingoEnCours.current[activite.id] = false; });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kept, theme]);

  const openPrintableInNewTab = () => {
    const rowsHtml = computedRows.map((row) => {
      if (row.type === "rotation") {
        const cells = row.cells.map((a) => `<td style="padding:10px;vertical-align:top;border-bottom:1px solid #EDE6D8;"><div style="font-weight:700;">${escapeHtml(a?.nom)}</div>${a?.lieu ? `<div style="font-size:12px;color:#7A7362;">${escapeHtml(a.lieu)}</div>` : ""}</td>`).join("");
        return `<tr><td style="padding:10px;vertical-align:top;border-bottom:1px solid #EDE6D8;font-weight:700;white-space:nowrap;">${escapeHtml(row.time)}</td>${cells}</tr>`;
      }
      if (row.type === "diner") {
        const cells = groups.map((_, i) => `<td style="padding:10px;vertical-align:top;border-bottom:1px solid #EDE6D8;">${escapeHtml(row.labels?.[i] || "")}</td>`).join("");
        return `<tr style="background:#FBF3E4;"><td style="padding:10px;font-weight:700;white-space:nowrap;">${escapeHtml(row.time)}</td>${cells}</tr>`;
      }
      return `<tr><td style="padding:10px;font-weight:700;white-space:nowrap;border-bottom:1px solid #EDE6D8;">${escapeHtml(row.time)}</td><td colspan="${groups.length}" style="padding:10px;border-bottom:1px solid #EDE6D8;">${escapeHtml(row.label)}</td></tr>`;
    }).join("");
    const headerCells = groups.map((g) => `<th style="text-align:left;padding:10px;background:#7C9070;color:white;font-size:11px;text-transform:uppercase;">${escapeHtml(g)}</th>`).join("");
    const materialHtml = materialList.map((m) => `<li style="margin-bottom:4px;">• ${escapeHtml(m)}</li>`).join("");

    let monthlyHtml = "";
    if (isMercredi && mercredis.length > 0) {
      const n = activitesParMercredi || 1;
      const monthlyRows = mercredis.map((d, i) => {
        const items = kept.slice(i * n, i * n + n);
        const cellHtml = items.length
          ? items.map((it, ii) => `<div style="${ii > 0 ? "margin-top:8px;padding-top:8px;border-top:1px solid #EDE6D8;" : ""}"><div style="font-weight:700;">${escapeHtml(it?.nom)}</div>${it?.lieu ? `<div style="font-size:12px;color:#7A7362;">${escapeHtml(it.lieu)}</div>` : ""}</div>`).join("")
          : "—";
        return `<tr style="border-bottom:1px solid #EDE6D8;"><td style="padding:10px;font-weight:700;white-space:nowrap;vertical-align:top;">${escapeHtml(formatDateFr(d))}</td><td style="padding:10px;vertical-align:top;">${cellHtml}</td></tr>`;
      }).join("");
      monthlyHtml = `<p style="color:#54634A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Horaire mensuelle</p>
<h1 style="color:#54634A;margin:4px 0 12px;">${escapeHtml(theme) || "Thème du mois"}</h1>
<table style="margin-bottom:24px;"><thead><tr><th style="text-align:left;padding:10px;background:#7C9070;color:white;font-size:11px;text-transform:uppercase;">Date</th><th style="text-align:left;padding:10px;background:#7C9070;color:white;font-size:11px;text-transform:uppercase;">Activité</th></tr></thead><tbody>${monthlyRows}</tbody></table>
<div style="page-break-before:always;"></div>`;
    }

    const fichesHtml = kept.map((st) => {
      const etapes = (st.deroulement || []).map((l, i) => `<li style="margin-bottom:6px;">${i + 1}. ${escapeHtml(l)}</li>`).join("");
      const materiel = (st.materiel || []).map((m) => `<li style="margin-bottom:4px;">• ${escapeHtml(m)}</li>`).join("");
      const mots = bingoMots[st.id];
      const bingoHtml = (activiteNecessiteBingo(st.nom) && mots && mots.length >= 24) ? (() => {
        const grille = [...mots.slice(0, 12), "GRATUIT", ...mots.slice(12, 24)];
        const cases = grille.map((mot) => `<td style="border:1px solid #E3DACB;text-align:center;padding:10px 4px;font-size:11px;font-weight:600;${mot === "GRATUIT" ? "background:#E4EEE4;color:#54634A;font-weight:700;" : ""}">${escapeHtml(mot)}</td>`).join("");
        return `<div style="page-break-before:always;padding:24px 0;">
        <p style="color:#54634A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Matériel — bingo</p>
        <h2 style="color:#54634A;margin:4px 0 12px;">${escapeHtml(st.nom)}</h2>
        <table style="max-width:480px;border-collapse:collapse;margin-top:12px;"><tr>${["B", "I", "N", "G", "O"].map((l) => `<td style="text-align:center;background:#7C9070;color:white;font-weight:700;padding:8px;">${l}</td>`).join("")}</tr>
        <tr>${cases.slice(0, 5).join("")}</tr><tr>${cases.slice(5, 10).join("")}</tr><tr>${cases.slice(10, 15).join("")}</tr><tr>${cases.slice(15, 20).join("")}</tr><tr>${cases.slice(20, 25).join("")}</tr></table>
      </div>`;
      })() : "";
      return `<div style="page-break-before:always;padding:24px 0;">
        <p style="color:#54634A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(st.lieu || "Plateau")}</p>
        <h2 style="color:#54634A;margin:4px 0 12px;">${escapeHtml(st.nom)}</h2>
        <p style="color:#7A7362;">${escapeHtml(st.age)} · ${escapeHtml(st.duree)}</p>
        ${st.amorce ? `<h3 style="color:#7C9070;font-size:13px;text-transform:uppercase;margin-top:16px;">Amorce</h3><p style="font-style:italic;">${escapeHtml(st.amorce)}</p>` : ""}
        ${etapes ? `<h3 style="color:#7C9070;font-size:13px;text-transform:uppercase;margin-top:16px;">Déroulement</h3><ol style="padding-left:18px;">${etapes}</ol>` : ""}
        ${materiel ? `<h3 style="color:#7C9070;font-size:13px;text-transform:uppercase;margin-top:16px;">Matériel</h3><ul style="list-style:none;padding-left:0;">${materiel}</ul>` : ""}
      </div>${bingoHtml}`;
    }).join("");

    const logoUrl = "data:image/png;base64,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";
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(theme) || "Planification"}</title>
<style>body{font-family:-apple-system,Nunito,sans-serif;color:#2B2A26;margin:24px;}table{width:100%;border-collapse:collapse;}.print-logo{position:fixed;bottom:8mm;right:8mm;height:12mm;width:auto;opacity:0.9;}@media print{@page{margin:12mm;}}</style></head><body>
<img src="${logoUrl}" class="print-logo" alt="PLANIF" />
${monthlyHtml}
<p style="color:#54634A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Horaire de la journée</p>
<h1 style="color:#54634A;margin:4px 0 12px;">${escapeHtml(theme) || "Thème de la journée"}</h1>
${dateLabel ? `<p style="color:#7A7362;">${escapeHtml(dateLabel)}</p>` : ""}
<table style="margin-top:16px;"><thead><tr><th style="text-align:left;padding:10px;background:#7C9070;color:white;font-size:11px;text-transform:uppercase;">Heure</th>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table>
${materialList.length ? `<h2 style="color:#54634A;margin-top:24px;">Matériel</h2><ul style="list-style:none;padding-left:0;">${materialHtml}</ul>` : ""}
${fichesHtml}
<p style="margin-top:24px;color:#B3A990;font-size:12px;">Ouvrez le menu de partage de votre navigateur pour imprimer ou enregistrer en PDF.</p>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(theme || "planification").replace(/[^a-z0-9]+/gi, "-")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="print-root max-w-4xl mx-auto px-4 py-8">
      <button onClick={onBack} className="no-print flex items-center gap-1.5 text-sm font-semibold text-[#7A7362] hover:text-[#7C9070] mb-4">
        <ChevronLeft size={16} /> Retour
      </button>
      {isMercredi && mercredis.length > 0 && (
        <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
          <header className="mb-6">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Horaire mensuelle</p>
            <h1 className="text-3xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>{theme || "Thème du mois"}</h1>
            <div className="leaf-underline w-16 mt-3" />
          </header>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-bold uppercase tracking-wide text-white p-3 rounded-tl-lg" style={{ background: COLORS.moss }}>Date</th>
                <th className="text-left text-xs font-bold uppercase tracking-wide text-white p-3 rounded-tr-lg" style={{ background: COLORS.moss }}>Activité</th>
              </tr>
            </thead>
            <tbody>
              {mercredis.map((d, i) => {
                const n = activitesParMercredi || 1;
                const items = kept.slice(i * n, i * n + n);
                return (
                  <tr key={i} className="border-b border-[#EDE6D8]">
                    <td className="p-3 font-semibold text-[#2B2A26] whitespace-nowrap align-top">{formatDateFr(d)}</td>
                    <td className="p-3 text-[#2B2A26]">
                      {items.length === 0 && "—"}
                      {items.map((it, ii) => (
                        <div key={ii} className={ii > 0 ? "mt-2 pt-2 border-t border-[#EDE6D8]" : ""}>
                          <div className="font-semibold">{it?.nom}</div>
                          {it?.lieu && <div className="text-xs text-[#7A7362]">{it.lieu}</div>}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Page 1: schedule */}
      <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
        <header className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Horaire de la journée</p>
          <h1 className="text-3xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>{theme || "Thème de la journée"}</h1>
          {dateLabel && <p className="text-[#7A7362] mt-1">{dateLabel}</p>}
          <div className="leaf-underline w-16 mt-3" />
        </header>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-xs font-bold uppercase tracking-wide text-white p-3 rounded-tl-lg" style={{ background: COLORS.moss }}>Heure</th>
              {groups.map((g, i) => (
                <th key={i} className={`text-left text-xs font-bold uppercase tracking-wide text-white p-3 ${i === groups.length - 1 ? "rounded-tr-lg" : ""}`} style={{ background: COLORS.moss }}>{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {computedRows.map((row) => {
              if (row.type === "rotation") {
                return (
                  <tr key={row.id} className="border-b border-[#EDE6D8]">
                    <td className="p-3 font-semibold text-[#2B2A26] align-top whitespace-nowrap">{row.time}</td>
                    {row.cells.map((activity, ci) => (
                      <td key={ci} className="p-3 align-top text-[#2B2A26]">
                        <div className="font-semibold">{activity?.nom}</div>
                        {activity?.lieu && <div className="text-xs text-[#7A7362]">{activity.lieu}</div>}
                      </td>
                    ))}
                  </tr>
                );
              }
              if (row.type === "diner") {
                return (
                  <tr key={row.id} className="border-b border-[#EDE6D8]" style={{ background: "#FBF3E4" }}>
                    <td className="p-3 font-semibold text-[#2B2A26] whitespace-nowrap">{row.time}</td>
                    {groups.map((_, i) => (
                      <td key={i} className="p-3 text-[#2B2A26]">{row.labels?.[i] || ""}</td>
                    ))}
                  </tr>
                );
              }
              return <ScheduleRow key={row.id} time={row.time} span={groups.length} label={row.label} />;
            })}
          </tbody>
        </table>
      </div>

      {/* Page: material summary */}
      {kept.length > 0 && (
        <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Préparation</p>
          <h2 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Matériel</h2>
          <div className="leaf-underline w-16 mt-3 mb-5" />

          <h3 className="text-sm font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: COLORS.moss }}>
            <ShoppingBag size={14} /> Liste de matériel combinée
          </h3>
          <ul className="text-sm space-y-1">
            {materialList.map((m, i) => <li key={i} className="flex gap-2"><span style={{ color: COLORS.marine }}>•</span>{m}</li>)}
          </ul>
        </div>
      )}

      {transitionEnabled && transitionData && (
        <>
          {transitionImages.length > 0 && <ColoringPrintPage formes={transitionData.formes} theme={theme} customImages={transitionImages} />}
          <WordSearchPrintPage wordSearch={transitionData.wordSearch} theme={theme} />
        </>
      )}

      {/* One page per activity */}
      {kept.map((st) => (
        <React.Fragment key={st.id}>
        <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>{st.lieu || "Plateau"}</p>
          <h2 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>{st.nom}</h2>
          <p className="text-[#7A7362] mt-0.5">{st.age} · {st.duree}</p>
          <div className="leaf-underline w-16 mt-3 mb-5" />

          {st.amorce && (
            <>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>Amorce</h3>
              <p className="text-[15px] text-[#2B2A26] italic mb-5 leading-relaxed">{st.amorce}</p>
            </>
          )}

          <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>Déroulement</h3>
          <ul className="space-y-2 mb-5">
            {(st.deroulement || []).map((line, i) => (
              <li key={i} className="flex gap-2 text-[15px] text-[#2B2A26] leading-relaxed">
                <span className="shrink-0 font-bold" style={{ color: COLORS.marine }}>{i + 1}.</span>{line}
              </li>
            ))}
          </ul>

          <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>Matériel</h3>
          <ul className="space-y-1">
            {(st.materiel || []).map((m, i) => (
              <li key={i} className="flex gap-2 text-[15px] text-[#2B2A26]"><span style={{ color: COLORS.marine }}>•</span>{m}</li>
            ))}
          </ul>
        </div>
        {activiteNecessiteBingo(st.nom) && (
          <BingoPrintPage nomActivite={st.nom} theme={theme} mots={bingoMots[st.id]} />
        )}
        </React.Fragment>
      ))}

      <div className="no-print flex flex-wrap justify-end gap-2 pb-6">
        <button onClick={openPrintableInNewTab} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: COLORS.moss }}>
          <Printer size={14} /> Télécharger la version imprimable
        </button>
        <button
          onClick={async () => {
            setSavingBiblio(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from("library_items").insert({
                user_id: user.id,
                title: theme || "Sans titre",
                payload: {
                  type: "journee",
                  theme, dateLabel, groups, kept, materialList,
                  isMercredi, activitesParMercredi,
                  mercredis: (mercredis || []).map((d) => d.toISOString()),
                  computedRows: computedRows.map((row) => ({
                    ...row,
                    cells: row.cells ? row.cells.map((c) => (c ? { nom: c.nom, lieu: c.lieu } : null)) : undefined,
                  })),
                },
              });
            }
            setSavingBiblio(false);
            setBiblioSaved(true);
            setTimeout(() => setBiblioSaved(false), 2000);
          }}
          disabled={savingBiblio || kept.length === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 disabled:opacity-50"
          style={{ color: COLORS.moss, borderColor: COLORS.moss }}
        >
          {savingBiblio ? "Enregistrement…" : biblioSaved ? "✓ Enregistré" : "Enregistrer dans ma bibliothèque"}
        </button>
      </div>
    </div>
  );
}

function ScheduleRow({ time, label, span }) {
  return (
    <tr className="border-b border-[#EDE6D8]">
      <td className="p-3 font-semibold text-[#2B2A26] whitespace-nowrap">{time}</td>
      <td className="p-3 text-[#2B2A26]" colSpan={span}>{label}</td>
    </tr>
  );
}

// ================= WEEKLY GRID TOOL (planification hebdomadaire) =================
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const WEEKLY_DEFAULT_PERIODES = ["Midi"];
const weeklyCellKey = (jour, periode) => `${jour}__${periode}`;
const weeklyEmptyCell = () => ({ activite: "", local: "", domaines: [], remarques: "", description: "", materiel: [], amorce: "", duree: "", resume: "" });

function weeklyBuildWeekPrompt({ theme, ages, cellsToFill }) {
  return `Tu conçois des activités pour la planification hebdomadaire d'un service de garde en milieu scolaire.

Thème du mois : "${theme}"
Groupes d'âge visés : ${ages.length ? ages.join(", ") : "4-12 ans, tous groupes"}
IMPORTANT : chaque activité doit se réaliser en 30 minutes maximum. N'excède jamais 30 minutes.
${agesInstruction(ages)}
Pour chaque case suivante (jour + période), propose UNE activité simple et courte, adaptée aux groupes d'âge visés et réalisable en service de garde. Si un lieu est déjà indiqué pour la case, utilise-le ; sinon, choisis un lieu approprié.
Pour chaque activité, écris aussi une courte amorce (3 à 5 phrases, à dire directement aux enfants) pour capter leur attention et introduire l'activité.
Pour chaque activité, écris aussi un court résumé (une seule phrase, environ 10-15 mots) décrivant simplement en quoi consiste l'activité, pour un aperçu rapide.
Cases à remplir : ${JSON.stringify(cellsToFill)}

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant/après, format exact :
[
  {
    "jour": "Lundi",
    "periode": "Midi",
    "activite": "Nom court de l'activité",
    "local": "Lieu suggéré",
    "domaines": ["Physique et moteur", "Cognitif"],
    "remarques": "Note brève optionnelle (matériel, variante...)",
    "amorce": "Courte amorce à dire aux enfants",
    "duree": "Durée estimée (ex. 30 minutes)",
    "resume": "Courte description en une phrase",
    "description": ["Étape 1 du déroulement", "Étape 2", "Étape 3"],
    "materiel": ["Item 1", "Item 2"]
  }
]
Les valeurs possibles pour "domaines" sont EXACTEMENT : "Physique et moteur", "Social", "Affectif", "Cognitif", "Langagier". Choisis 1 à 3 domaines pertinents par activité. "description" est le déroulement en 2 à 4 étapes courtes.`;
}

function weeklyBuildSingleCellPrompt({ theme, ages, jour, periode, lieu, avoid }) {
  return `Tu conçois une activité pour la planification hebdomadaire d'un service de garde en milieu scolaire.

Thème du mois : "${theme}"
Groupes d'âge visés : ${ages.length ? ages.join(", ") : "4-12 ans, tous groupes"}
Jour : ${jour}, période : ${periode}
Lieu (si fourni, à respecter) : ${lieu || "au choix"}
Durée : 30 minutes maximum. N'excède jamais 30 minutes.
Évite de répéter : ${avoid || "aucune activité à éviter"}
${agesInstruction(ages)}
Réponds UNIQUEMENT avec un objet JSON valide, format exact :
{
  "activite": "Nom court",
  "local": "Lieu suggéré",
  "domaines": ["Physique et moteur", "Cognitif"],
  "remarques": "Note brève optionnelle",
  "amorce": "Courte amorce à dire aux enfants",
  "duree": "Durée estimée (ex. 30 minutes)",
  "resume": "Courte description en une phrase",
  "description": ["Étape 1 du déroulement", "Étape 2", "Étape 3"],
  "materiel": ["Item 1", "Item 2"]
}
Les valeurs possibles pour "domaines" sont EXACTEMENT : "Physique et moteur", "Social", "Affectif", "Cognitif", "Langagier". Choisis 1 à 3 domaines pertinents. "description" est le déroulement en 2 à 4 étapes courtes.`;
}

function WeeklyGridTool() {
  const [wtab, setWtab] = useState("configurer"); // configurer | apercu
  useEffect(() => { window.scrollTo(0, 0); }, [wtab]);

  const [educatrice, setEducatrice] = useState("");
  const [semaine, setSemaine] = useState("");
  const [groupeNom, setGroupeNom] = useState("");
  const [wAges, setWAges] = useState(["4-6 ans", "7-9 ans", "10-12 ans"]);
  const [theme, setTheme] = useState("");

  const [jours, setJours] = useState(() => ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map((name) => ({ id: `jour-${name.toLowerCase()}`, name, lieu: "" })));
  const [savingLieux, setSavingLieux] = useState(false);
  const [lieuxSaved, setLieuxSaved] = useState(false);
  const [savingBiblio, setSavingBiblio] = useState(false);
  const [biblioSaved, setBiblioSaved] = useState(false);
  const [bingoMots, setBingoMots] = useState({}); // { [jour__periode]: string[] }
  const bingoEnCours = useRef({});
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_settings").select("jours_lieux").eq("user_id", user.id).maybeSingle();
      if (data?.jours_lieux?.length) {
        setJours((cur) => cur.map((j) => {
          const saved = data.jours_lieux.find((s) => s.name === j.name);
          return saved ? { ...j, lieu: saved.lieu || "" } : j;
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [periodes, setPeriodes] = useState(WEEKLY_DEFAULT_PERIODES);
  const [selectedPeriodes, setSelectedPeriodes] = useState(WEEKLY_DEFAULT_PERIODES);
  const visiblePeriodes = periodes.filter((p) => selectedPeriodes.includes(p));
  const [cells, setCells] = useState({});

  const [loadingWeek, setLoadingWeek] = useState(false);
  const [loadingCell, setLoadingCell] = useState(null);
  const [expandedCell, setExpandedCell] = useState(null);
  const [error, setError] = useState("");

  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [transitionData, setTransitionData] = useState(null);
  const [loadingTransition, setLoadingTransition] = useState(false);
  const [transitionError, setTransitionError] = useState("");
  const [transitionImages, setTransitionImages] = useState([]);
  const handleTransitionImageUpload = (files) => {
    const list = Array.from(files || []);
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => setTransitionImages((cur) => [...cur, e.target.result]);
      reader.readAsDataURL(file);
    });
  };
  const removeTransitionImage = (idx) => setTransitionImages((cur) => cur.filter((_, i) => i !== idx));
  const generateTransition = async () => {
    setLoadingTransition(true);
    setTransitionError("");
    try {
      const raw = await askClaude(buildTransitionPrompt({ theme }));
      const formes = normalizeFormes(raw.formes);
      const mots = Array.isArray(raw.mots) ? raw.mots : [];
      const imagePrompts = Array.isArray(raw.imagePrompts) ? raw.imagePrompts.filter(Boolean) : [];
      setTransitionData({ formes, wordSearch: buildWordSearch(mots), imagePrompts });
      setTransitionForTheme(theme);
    } catch (e) {
      setTransitionError(friendlyGenerationError(e, "Échec de la génération"));
    } finally {
      setLoadingTransition(false);
    }
  };
  // Même logique automatique que dans les autres modes : dès que la case
  // est cochée (ou que le thème change ensuite), plus besoin de bouton.
  const [transitionForTheme, setTransitionForTheme] = useState(null);
  const transitionEnCours = useRef(false);
  useEffect(() => {
    if (!transitionEnabled || !theme.trim()) return;
    if (transitionForTheme === theme) return;
    if (transitionEnCours.current) return;
    transitionEnCours.current = true;
    generateTransition().finally(() => { transitionEnCours.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionEnabled, theme]);

  const getCell = (jour, periode) => cells[weeklyCellKey(jour, periode)] || weeklyEmptyCell();
  const setCell = (jour, periode, patch) =>
    setCells((cur) => ({ ...cur, [weeklyCellKey(jour, periode)]: { ...getCell(jour, periode), ...patch } }));

  // Génération automatique du bingo pour toute case dont le nom d'activité
  // contient "bingo" — même logique que dans les autres modes, déclenchée
  // uniquement côté navigateur (useEffect), jamais pendant le rendu initial.
  useEffect(() => {
    jours.forEach((jourObj) => {
      visiblePeriodes.forEach((periode) => {
        const cell = getCell(jourObj.name, periode);
        if (!activiteNecessiteBingo(cell.activite)) return;
        const key = weeklyCellKey(jourObj.name, periode);
        if (bingoMots[key] || bingoEnCours.current[key]) return;
        bingoEnCours.current[key] = true;
        askClaude(buildBingoPrompt({ theme, nomActivite: cell.activite }))
          .then((mots) => {
            if (Array.isArray(mots) && mots.length >= 24) {
              setBingoMots((cur) => ({ ...cur, [key]: mots }));
            }
          })
          .catch(() => {})
          .finally(() => { bingoEnCours.current[key] = false; });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, theme, visiblePeriodes.join(","), jours.map((j) => j.name).join(",")]);

  const toggleDomaine = (jour, periode, domaine) => {
    const cell = getCell(jour, periode);
    const has = cell.domaines.includes(domaine);
    setCell(jour, periode, { domaines: has ? cell.domaines.filter((d) => d !== domaine) : [...cell.domaines, domaine] });
  };

  const addJour = () => setJours((j) => [...j, { id: nextId(), name: "Nouveau jour", lieu: "" }]);
  const removeJour = (idx) => setJours((j) => j.filter((_, i) => i !== idx));
  const renameJour = (idx, val) => setJours((j) => j.map((x, i) => (i === idx ? { ...x, name: val } : x)));
  const renameJourLieu = (idx, val) => setJours((j) => j.map((x, i) => (i === idx ? { ...x, lieu: val } : x)));

  const addPeriode = () => { setPeriodes((p) => [...p, ""]); setSelectedPeriodes((p) => [...p, ""]); };
  const removePeriode = (idx) => {
    const removed = periodes[idx];
    setPeriodes((p) => p.filter((_, i) => i !== idx));
    setSelectedPeriodes((p) => p.filter((x) => x !== removed));
  };
  const renamePeriode = (idx, val) => {
    const old = periodes[idx];
    setPeriodes((p) => p.map((x, i) => (i === idx ? val : x)));
    setSelectedPeriodes((p) => p.map((x) => (x === old ? val : x)));
  };
  const togglePeriodeSelected = (p) => setSelectedPeriodes((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const generateWeek = async () => {
    setError("");
    setLoadingWeek(true);
    try {
      if (selectedPeriodes.length === 0) throw new Error("Sélectionnez au moins une période.");
      const cellsToFill = [];
      jours.forEach((j) => selectedPeriodes.forEach((p) => cellsToFill.push({ jour: j.name, periode: p, lieu: j.lieu || undefined })));
      const raw = await askClaude(weeklyBuildWeekPrompt({ theme, ages: wAges, cellsToFill }), Math.min(8000, 1200 + cellsToFill.length * 500));
      const next = { ...cells };
      raw.forEach((r) => {
        next[weeklyCellKey(r.jour, r.periode)] = {
          activite: r.activite || "",
          local: r.local || "",
          domaines: Array.isArray(r.domaines) ? r.domaines.filter((d) => DOMAINES.includes(d)) : [],
          remarques: r.remarques || "",
          amorce: r.amorce || "",
          duree: r.duree || "",
          resume: r.resume || "",
          description: Array.isArray(r.description) ? r.description.join("\n") : (r.description || ""),
          materiel: Array.isArray(r.materiel) ? r.materiel : (r.materiel ? [r.materiel] : []),
        };
      });
      setCells(next);
    } catch (e) {
      setError(friendlyGenerationError(e));
    } finally {
      setLoadingWeek(false);
    }
  };

  const regenerateCell = async (jourName, periode, jourLieu) => {
    const key = weeklyCellKey(jourName, periode);
    setError("");
    setLoadingCell(key);
    try {
      const avoid = Object.values(cells).map((c) => c.activite).filter(Boolean).join(", ");
      const raw = await askClaude(weeklyBuildSingleCellPrompt({ theme, ages: wAges, jour: jourName, periode, lieu: jourLieu, avoid }));
      setCell(jourName, periode, {
        activite: raw.activite || "",
        local: raw.local || "",
        domaines: Array.isArray(raw.domaines) ? raw.domaines.filter((d) => DOMAINES.includes(d)) : [],
        remarques: raw.remarques || "",
        amorce: raw.amorce || "",
        duree: raw.duree || "",
        resume: raw.resume || "",
        description: Array.isArray(raw.description) ? raw.description.join("\n") : (raw.description || ""),
        materiel: Array.isArray(raw.materiel) ? raw.materiel : (raw.materiel ? [raw.materiel] : []),
      });
    } catch (e) {
      setError(friendlyGenerationError(e));
    } finally {
      setLoadingCell(null);
    }
  };

  const [generatingAmorceKey, setGeneratingAmorceKey] = useState(null);
  const generateAmorceForCell = async (jourName, periode) => {
    const key = weeklyCellKey(jourName, periode);
    const cell = getCell(jourName, periode);
    setGeneratingAmorceKey(key);
    try {
      const amorce = await askClaudeText(buildAmorcePrompt({ nom: cell.activite, age: wAges.join(", "), lieu: cell.local, deroulement: (cell.description || "").split("\n").filter((l) => l.trim()) }));
      setCell(jourName, periode, { amorce });
    } catch (e) {
      setCell(jourName, periode, { amorceError: e.message || "échec" });
    } finally {
      setGeneratingAmorceKey(null);
    }
  };

  const openPrintableInNewTab = () => {
    const rows = jours.map((jourObj) => {
      const c = visiblePeriodes.map((periode) => {
        const cell = getCell(jourObj.name, periode);
        const labelStyle = "font-weight:700;font-size:11px;color:#7C9070;";
        const valueStyle = "font-size:11px;color:#2B2A26;margin-bottom:4px;";
        return `<td style="padding:10px;vertical-align:top;border-bottom:1px solid #EDE6D8;">
          <div style="${labelStyle}">Activité :</div><div style="${valueStyle}">${escapeHtml(cell.activite) || "—"}</div>
          ${cell.resume ? `<div style="${labelStyle}">Description :</div><div style="${valueStyle}">${escapeHtml(cell.resume)}</div>` : ""}
          ${cell.materiel?.filter((m) => m.trim()).length ? `<div style="${labelStyle}">Matériel :</div><div style="${valueStyle}">${escapeHtml(cell.materiel.filter((m) => m.trim()).join(", "))}</div>` : ""}
          ${cell.domaines.length ? `<div style="${labelStyle}">Aspects du développement :</div><div style="font-size:11px;color:#7C9070;">${escapeHtml(cell.domaines.join(" · "))}</div>` : ""}
        </td>`;
      }).join("");
      return `<tr><td style="padding:10px;vertical-align:top;border-bottom:1px solid #EDE6D8;font-weight:700;white-space:nowrap;">${escapeHtml(jourObj.name)}<div style="font-weight:400;font-size:11px;color:#7A7362;margin-top:2px;">Lieu : ${escapeHtml(jourObj.lieu) || "—"}</div></td>${c}</tr>`;
    }).join("");
    const headerCells = visiblePeriodes.map((p) => `<th style="text-align:left;padding:10px;background:#7C9070;color:white;font-size:11px;text-transform:uppercase;">${escapeHtml(p)}</th>`).join("");

    const fichesHtml = [];
    jours.forEach((jourObj) => visiblePeriodes.forEach((periode) => {
      const c = getCell(jourObj.name, periode);
      if (!c.activite?.trim()) return;
      const etapes = (c.description || "").split("\n").filter((l) => l.trim()).map((l, i) => `<li style="margin-bottom:6px;">${i + 1}. ${escapeHtml(l)}</li>`).join("");
      const materiel = (c.materiel || []).filter((m) => m.trim()).map((m) => `<li style="margin-bottom:4px;">• ${escapeHtml(m)}</li>`).join("");
      fichesHtml.push(`<div style="page-break-before:always;padding:24px 0;">
        <p style="color:#54634A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(jourObj.name)} · ${escapeHtml(periode)}${c.local ? " · " + escapeHtml(c.local) : ""}${c.duree ? " · " + escapeHtml(c.duree) : ""}</p>
        <h2 style="color:#54634A;margin:4px 0 12px;">${escapeHtml(c.activite)}</h2>
        ${c.domaines.length ? `<p style="color:#7A7362;">${c.domaines.map(escapeHtml).join(" · ")}</p>` : ""}
        ${c.amorce ? `<h3 style="color:#7C9070;font-size:13px;text-transform:uppercase;margin-top:16px;">Amorce</h3><p style="font-style:italic;">${escapeHtml(c.amorce)}</p>` : ""}
        ${etapes ? `<h3 style="color:#7C9070;font-size:13px;text-transform:uppercase;margin-top:16px;">Déroulement</h3><ol style="padding-left:18px;">${etapes}</ol>` : ""}
        ${materiel ? `<h3 style="color:#7C9070;font-size:13px;text-transform:uppercase;margin-top:16px;">Matériel</h3><ul style="list-style:none;padding-left:0;">${materiel}</ul>` : ""}
        ${c.remarques ? `<p style="color:#7A7362;font-style:italic;margin-top:12px;">${escapeHtml(c.remarques)}</p>` : ""}
      </div>`);
      const motsBingo = bingoMots[weeklyCellKey(jourObj.name, periode)];
      if (activiteNecessiteBingo(c.activite) && motsBingo && motsBingo.length >= 24) {
        const grille = [...motsBingo.slice(0, 12), "GRATUIT", ...motsBingo.slice(12, 24)];
        const cases = grille.map((mot) => `<td style="border:1px solid #E3DACB;text-align:center;padding:10px 4px;font-size:11px;font-weight:600;${mot === "GRATUIT" ? "background:#E4EEE4;color:#54634A;font-weight:700;" : ""}">${escapeHtml(mot)}</td>`);
        fichesHtml.push(`<div style="page-break-before:always;padding:24px 0;">
        <p style="color:#54634A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Matériel — bingo</p>
        <h2 style="color:#54634A;margin:4px 0 12px;">${escapeHtml(c.activite)}</h2>
        <table style="max-width:480px;border-collapse:collapse;margin-top:12px;"><tr>${["B", "I", "N", "G", "O"].map((l) => `<td style="text-align:center;background:#7C9070;color:white;font-weight:700;padding:8px;">${l}</td>`).join("")}</tr>
        <tr>${cases.slice(0, 5).join("")}</tr><tr>${cases.slice(5, 10).join("")}</tr><tr>${cases.slice(10, 15).join("")}</tr><tr>${cases.slice(15, 20).join("")}</tr><tr>${cases.slice(20, 25).join("")}</tr></table>
      </div>`);
      }
    }));

    const logoUrl = "data:image/png;base64,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";
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Planification hebdomadaire</title>
<style>body{font-family:-apple-system,Nunito,sans-serif;color:#2B2A26;margin:24px;}table{width:100%;border-collapse:collapse;}.print-logo{position:fixed;bottom:8mm;right:8mm;height:12mm;width:auto;opacity:0.9;}@media print{@page{size:landscape;margin:12mm;}}</style></head><body>
<img src="${logoUrl}" class="print-logo" alt="PLANIF" />
<p style="color:#54634A;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Résumé de la semaine</p>
<h1 style="color:#54634A;margin:4px 0 14px;">Planification hebdomadaire</h1>
<table style="margin-bottom:6px;"><tr>
  <td style="padding:4px 0;color:#54634A;font-weight:700;">Groupe : <span style="font-weight:400;color:#2B2A26;">${escapeHtml(groupeNom) || "—"}</span></td>
  <td style="padding:4px 0;color:#54634A;font-weight:700;">Éducateur·trice : <span style="font-weight:400;color:#2B2A26;">${escapeHtml(educatrice) || "—"}</span></td>
</tr><tr>
  <td style="padding:4px 0;color:#54634A;font-weight:700;">Semaine : <span style="font-weight:400;color:#2B2A26;">${escapeHtml(semaine) || "—"}</span></td>
  <td style="padding:4px 0;color:#54634A;font-weight:700;">Thème : <span style="font-weight:400;color:#2B2A26;">${escapeHtml(theme) || "—"}</span></td>
</tr></table>
<table style="margin-top:16px;"><thead><tr><th style="text-align:left;padding:10px;background:#7C9070;color:white;font-size:11px;text-transform:uppercase;">Jour</th>${headerCells}</tr></thead><tbody>${rows}</tbody></table>
${fichesHtml.join("")}
<p style="margin-top:24px;color:#B3A990;font-size:12px;">Ouvrez le menu de partage de votre navigateur pour imprimer ou enregistrer en PDF.</p>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(theme || groupeNom || semaine || "grille-hebdomadaire").replace(/[^a-z0-9]+/gi, "-")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const fiches = [];
  jours.forEach((jourObj) => visiblePeriodes.forEach((periode) => {
    const c = getCell(jourObj.name, periode);
    if (c.activite?.trim()) fiches.push({ key: jourObj.id + periode, jour: jourObj.name, periode, cell: c });
  }));

  return (
    <div>
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 12mm; }
        }
      `}</style>

      {wtab === "configurer" ? (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Bâtir la semaine</h1>
            <p className="text-[#7A7362] mt-1 max-w-2xl">
              Remplissez l'en-tête, choisissez les périodes à générer, puis laissez l'outil proposer des activités — modifiables case par case.
            </p>
          </div>

          <SectionCard>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Éducateur·trice</label>
                <div className="mt-1"><TextField value={educatrice} onChange={setEducatrice} placeholder="Nom" /></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Semaine</label>
                <div className="mt-1"><TextField value={semaine} onChange={setSemaine} placeholder="Ex. 16 au 20 mars 2026" /></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Groupe</label>
                <div className="mt-1"><TextField value={groupeNom} onChange={setGroupeNom} placeholder="Ex. 201-201 ou Les astronautes" /></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide flex items-center gap-1.5"><Users size={12} /> Groupes d'âge (pour la génération)</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {AGES.map((a) => (
                    <Chip key={a} active={wAges.includes(a)} onClick={() => setWAges((c) => (c.includes(a) ? c.filter((x) => x !== a) : [...c, a]))}>{a}</Chip>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Thème</label>
                <div className="mt-1 max-w-sm"><TextField value={theme} onChange={setTheme} placeholder="Ex. Alimentation" /></div>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <h3 className="font-semibold mb-3" style={{ fontFamily: "Baloo 2, sans-serif" }}>Jours</h3>
            <div className="space-y-2">
              {jours.map((j, idx) => (
                <div key={j.id} className="flex items-center gap-2 bg-white border border-[#DCD3C2] rounded-lg pl-2 pr-1 py-1.5">
                  <input value={j.name} onChange={(e) => renameJour(idx, e.target.value)} className="text-sm font-semibold w-28 focus:outline-none" />
                  <span className="text-[#B3A990] text-xs">lieu :</span>
                  <input value={j.lieu} onChange={(e) => renameJourLieu(idx, e.target.value)} placeholder="Ex. Gymnase" className="text-sm flex-1 min-w-0 focus:outline-none" />
                  <IconBtn danger title="Retirer" onClick={() => removeJour(idx)}><Trash2 size={13} /></IconBtn>
                </div>
              ))}
              <button onClick={addJour} className="flex items-center gap-1 text-sm font-semibold text-[#7C9070]"><Plus size={14} /> Jour</button>
            </div>
            <button
              onClick={async () => {
                setSavingLieux(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase.from("user_settings").upsert({
                    user_id: user.id,
                    jours_lieux: jours.map((j) => ({ name: j.name, lieu: j.lieu })),
                    updated_at: new Date().toISOString(),
                  });
                }
                setSavingLieux(false);
                setLieuxSaved(true);
                setTimeout(() => setLieuxSaved(false), 2000);
              }}
              disabled={savingLieux}
              className="mt-3 w-full text-center text-sm font-semibold text-white py-2.5 rounded-lg disabled:opacity-50"
              style={{ background: COLORS.moss }}
            >
              {savingLieux ? "Enregistrement…" : lieuxSaved ? "✓ Enregistré" : "Enregistrer les lieux"}
            </button>
          </SectionCard>

          <SectionCard>
            <h3 className="font-semibold mb-3" style={{ fontFamily: "Baloo 2, sans-serif" }}>Périodes — cochez celles à générer</h3>
            <div className="flex flex-wrap gap-2">
              {periodes.map((p, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-white border border-[#DCD3C2] rounded-lg pl-1 pr-1 py-1">
                  <label className="flex items-center gap-1.5 pl-1.5 cursor-pointer">
                    <input type="checkbox" checked={selectedPeriodes.includes(p)} onChange={() => togglePeriodeSelected(p)} className="w-4 h-4 accent-[#7C9070]" />
                    <input value={p} onChange={(e) => renamePeriode(idx, e.target.value)} placeholder="Ex. Midi" className="text-sm w-28 focus:outline-none" />
                  </label>
                  <IconBtn danger title="Retirer" onClick={() => removePeriode(idx)}><Trash2 size={13} /></IconBtn>
                </div>
              ))}
              <button onClick={addPeriode} className="flex items-center gap-1 text-sm font-semibold text-[#7C9070] px-2"><Plus size={14} /> Période</button>
            </div>

            <button
              onClick={generateWeek}
              disabled={loadingWeek || !theme.trim() || selectedPeriodes.length === 0}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold disabled:opacity-50"
              style={{ background: COLORS.moss }}
            >
              {loadingWeek && <Loader2 size={16} className="animate-spin" />}
              {loadingWeek ? "Génération en cours…" : `Générer pour ${selectedPeriodes.length} période${selectedPeriodes.length > 1 ? "s" : ""} × ${jours.length} jours`}
            </button>
            {error && <p className="text-sm mt-2" style={{ color: COLORS.danger }}>{error}</p>}
          </SectionCard>

          <SectionCard>
            <h3 className="font-semibold mb-3" style={{ fontFamily: "Baloo 2, sans-serif" }}>Grille — modifiable case par case</h3>
            {visiblePeriodes.length === 0 && (
              <p className="text-sm mb-3 px-3 py-2 rounded-lg bg-[#FBF3E4] text-[#8A6A2B]">Aucune période cochée ci-dessus — cochez au moins une période pour voir la grille.</p>
            )}
            <div className="space-y-4">
              {jours.map((jourObj) => (
                <div key={jourObj.id}>
                  <p className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>
                    {jourObj.name}{jourObj.lieu && <span className="font-normal normal-case text-[#B3A990]"> — {jourObj.lieu}</span>}
                  </p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {visiblePeriodes.map((periode) => {
                      const cell = getCell(jourObj.name, periode);
                      const key = weeklyCellKey(jourObj.name, periode);
                      return (
                        <div key={periode} className="border border-[#E3DACB] rounded-xl p-3 bg-white/60">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-[#7A7362] uppercase">{periode}</span>
                            <button
                              onClick={() => regenerateCell(jourObj.name, periode, jourObj.lieu)}
                              disabled={loadingCell === key || !theme.trim()}
                              className="text-[#7C9070] hover:text-[#54634A] disabled:opacity-40"
                              title="Générer / régénérer cette case"
                            >
                              {loadingCell === key ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            </button>
                          </div>
                          <TextField value={cell.activite} onChange={(v) => setCell(jourObj.name, periode, { activite: v })} placeholder="Activité" className="mb-1.5" />
                          <div className="flex gap-1.5 mb-2">
                            <TextField value={cell.local} onChange={(v) => setCell(jourObj.name, periode, { local: v })} placeholder="Local" />
                            <TextField value={cell.duree} onChange={(v) => setCell(jourObj.name, periode, { duree: v })} placeholder="Durée" className="max-w-[90px]" />
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {DOMAINES.map((d) => (
                              <button
                                key={d}
                                onClick={() => toggleDomaine(jourObj.name, periode, d)}
                                className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${cell.domaines.includes(d) ? "text-white border-transparent" : "text-[#B3A990] border-[#DCD3C2] bg-white"}`}
                                style={cell.domaines.includes(d) ? { background: COLORS.moss } : {}}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                          <TextField value={cell.remarques} onChange={(v) => setCell(jourObj.name, periode, { remarques: v })} placeholder="Moyens / remarques" />

                          <button onClick={() => setExpandedCell(expandedCell === key ? null : key)} className="mt-2 text-xs font-semibold text-[#7C9070] hover:underline">
                            {expandedCell === key ? "▲ Cacher la fiche" : "▼ Déroulement et matériel"}
                          </button>
                          {expandedCell === key && (
                            <div className="mt-2 space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7A7362] block">Amorce</label>
                              {cell.amorce ? (
                                <textarea
                                  value={cell.amorce}
                                  onChange={(e) => setCell(jourObj.name, periode, { amorce: e.target.value })}
                                  rows={2}
                                  className="w-full bg-white border border-[#DCD3C2] rounded-lg px-2.5 py-1.5 text-sm text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#7C9070]"
                                />
                              ) : (
                                <p className="text-xs text-[#B3A990]">{cell.amorceError ? `Échec : ${cell.amorceError}` : "Pas encore générée."}</p>
                              )}

                              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7A7362]">Déroulement (une étape par ligne)</label>
                              <textarea
                                value={cell.description}
                                onChange={(e) => setCell(jourObj.name, periode, { description: e.target.value })}
                                rows={3}
                                placeholder="Étape 1&#10;Étape 2&#10;Étape 3"
                                className="w-full bg-white border border-[#DCD3C2] rounded-lg px-2.5 py-1.5 text-sm text-[#2B2A26] placeholder-[#B3A990] focus:outline-none focus:ring-2 focus:ring-[#7C9070]"
                              />
                              <label className="text-[10px] font-bold uppercase tracking-wide text-[#7A7362]">Matériel</label>
                              <div className="space-y-1">
                                {cell.materiel.map((m, mi) => (
                                  <div key={mi} className="flex items-center gap-1.5">
                                    <span className="text-[#B3A990] text-xs">•</span>
                                    <TextField
                                      value={m}
                                      onChange={(v) => setCell(jourObj.name, periode, { materiel: cell.materiel.map((x, xi) => (xi === mi ? v : x)) })}
                                      placeholder="Item"
                                    />
                                    <IconBtn danger title="Retirer" onClick={() => setCell(jourObj.name, periode, { materiel: cell.materiel.filter((_, xi) => xi !== mi) })}><Trash2 size={13} /></IconBtn>
                                  </div>
                                ))}
                                <button onClick={() => setCell(jourObj.name, periode, { materiel: [...cell.materiel, ""] })} className="flex items-center gap-1 text-xs font-semibold text-[#7C9070]">
                                  <Plus size={12} /> Item
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={transitionEnabled}
                onChange={(e) => setTransitionEnabled(e.target.checked)}
                className="w-4 h-4 rounded accent-[#7C9070]"
              />
              <span className="font-semibold" style={{ fontFamily: "Baloo 2, sans-serif" }}>Fiches de transition <span className="font-normal text-xs text-[#7A7362]">(coloriages et mots cachés)</span></span>
            </label>
            {transitionEnabled && (
              <div className="mt-3 ml-6">
                {loadingTransition && (
                  <p className="text-sm text-[#7A7362] flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Génération en cours…</p>
                )}
                {transitionError && <p className="text-sm mt-2" style={{ color: COLORS.danger }}>{transitionError}</p>}
                {transitionData && !transitionError && (
                  <div className="mt-3 p-3 rounded-lg border border-[#E3DACB] bg-white">
                    <p className="text-xs font-bold text-[#7C9070] mb-2">✓ Prêtes — s'ajouteront à l'aperçu</p>
                    <p className="text-xs text-[#7A7362] mb-2">Mots cachés et coloriage.</p>
                    {transitionData.imagePrompts?.length > 0 && (
                      <div className="pt-2 border-t border-[#EDE6D8]">
                        <p className="text-xs font-bold text-[#7A7362] mb-1">Pour un vrai coloriage illustré :</p>
                        <p className="text-xs text-[#7A7362] mb-2">Sur educol.net, entrez une description du dessin voulu (ex. « un renard curieux dans une forêt d'automne ») pour obtenir un coloriage prêt à imprimer.</p>
                        {transitionData.imagePrompts.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 bg-[#FBF3E4] rounded px-2 py-1 mt-1">
                            <p className="text-xs text-[#2B2A26] italic flex-1">« {p} »</p>
                            <button onClick={() => navigator.clipboard.writeText(p)} className="text-[10px] font-bold text-[#7C9070] bg-white border border-[#DCD3C2] rounded px-2 py-1 shrink-0">Copier</button>
                          </div>
                        ))}
                        <a href="https://educol.net" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: COLORS.moss }}>
                          Ouvrir educol.net ↗
                        </a>
                        <div className="mt-2">
                          <label className="text-xs font-semibold text-[#7C9070] cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCD3C2] hover:border-[#7C9070]">
                            <Sparkles size={12} /> Importer une ou plusieurs images
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleTransitionImageUpload(e.target.files)} />
                          </label>
                          {transitionImages.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {transitionImages.map((img, i) => (
                                <div key={i} className="relative">
                                  <img src={img} alt="" className="w-14 h-14 object-cover rounded-lg border border-[#DCD3C2]" />
                                  <button onClick={() => removeTransitionImage(i)} className="absolute -top-1.5 -right-1.5 bg-white border border-[#DCD3C2] rounded-full w-5 h-5 flex items-center justify-center text-[#B3A990] hover:text-red-500">
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <div className="flex justify-end pb-6">
            <button
              onClick={() => setWtab("apercu")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold"
              style={{ background: COLORS.moss }}
            >
              Voir l'aperçu <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <button onClick={() => setWtab("configurer")} className="no-print flex items-center gap-1.5 text-sm font-semibold text-[#7A7362] hover:text-[#7C9070] mb-4">
            <ChevronLeft size={16} /> Retour
          </button>
          {visiblePeriodes.length > 0 && (
            <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-6 sm:p-8 mb-6" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Résumé de la semaine</p>
              <h1 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Planification hebdomadaire</h1>
              <div className="leaf-underline w-16 mt-2 mb-4" />
              <div className="flex flex-wrap gap-x-6 gap-y-1 mb-5 text-sm">
                <div><span className="text-[#7A7362]">Groupe :</span> <strong>{groupeNom || "—"}</strong></div>
                <div><span className="text-[#7A7362]">Éducateur·trice :</span> <strong>{educatrice || "—"}</strong></div>
                <div><span className="text-[#7A7362]">Semaine :</span> <strong>{semaine || "—"}</strong></div>
                <div><span className="text-[#7A7362]">Thème :</span> <strong>{theme || "—"}</strong></div>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-bold uppercase tracking-wide text-white p-3 rounded-tl-lg" style={{ background: COLORS.moss }}>Jour</th>
                    {visiblePeriodes.map((p, i) => (
                      <th key={p} className={`text-left text-xs font-bold uppercase tracking-wide text-white p-3 ${i === visiblePeriodes.length - 1 ? "rounded-tr-lg" : ""}`} style={{ background: COLORS.moss }}>{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jours.map((jourObj) => (
                    <tr key={jourObj.id} className="border-b border-[#EDE6D8]">
                      <td className="p-3 font-bold text-[#2B2A26] align-top whitespace-nowrap">
                        {jourObj.name}
                        {jourObj.lieu && <div className="text-xs font-normal text-[#7A7362]">{jourObj.lieu}</div>}
                      </td>
                      {visiblePeriodes.map((periode) => {
                        const cell = getCell(jourObj.name, periode);
                        return (
                          <td key={periode} className="p-3 align-top text-[#2B2A26]">
                            <div className="text-xs font-bold" style={{ color: COLORS.moss }}>Activité :</div>
                            <div className="text-xs mb-1">{cell.activite || "—"}</div>
                            {cell.resume && (
                              <>
                                <div className="text-xs font-bold" style={{ color: COLORS.moss }}>Description :</div>
                                <div className="text-xs mb-1">{cell.resume}</div>
                              </>
                            )}
                            {cell.materiel?.filter((m) => m.trim()).length > 0 && (
                              <div className="text-xs mt-1"><span className="font-bold" style={{ color: COLORS.moss }}>Matériel :</span> {cell.materiel.filter((m) => m.trim()).join(", ")}</div>
                            )}
                            {cell.domaines.length > 0 && (
                              <>
                                <div className="text-xs font-bold mt-1" style={{ color: COLORS.moss }}>Aspects du développement :</div>
                                <div className="text-xs" style={{ color: COLORS.moss }}>{cell.domaines.join(" · ")}</div>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {transitionEnabled && transitionData && (
            <>
              {transitionImages.length > 0 && <ColoringPrintPage formes={transitionData.formes} theme={theme} customImages={transitionImages} />}
              <WordSearchPrintPage wordSearch={transitionData.wordSearch} theme={theme} />
            </>
          )}

          {fiches.map(({ key, jour, periode, cell }) => (
            <React.Fragment key={key}>
            <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-6 sm:p-8 mb-6" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>{jour} · {periode}{cell.local ? ` · ${cell.local}` : ""}{cell.duree ? ` · ${cell.duree}` : ""}</p>
              <h2 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>{cell.activite}</h2>
              {cell.domaines.length > 0 && <p className="text-[#7A7362] mt-1">{cell.domaines.join(" · ")}</p>}
              <div className="leaf-underline w-16 mt-3 mb-5" />
              {cell.amorce && (
                <>
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>Amorce</h3>
                  <p className="text-[15px] text-[#2B2A26] italic mb-5 leading-relaxed">{cell.amorce}</p>
                </>
              )}
              {cell.description && (
                <>
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>Déroulement</h3>
                  <ul className="space-y-2 mb-5">
                    {cell.description.split("\n").filter((l) => l.trim()).map((line, i) => (
                      <li key={i} className="flex gap-2 text-[15px] text-[#2B2A26] leading-relaxed">
                        <span className="shrink-0 font-bold" style={{ color: COLORS.marine }}>{i + 1}.</span>{line}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {cell.materiel?.length > 0 && (
                <>
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>Matériel</h3>
                  <ul className="space-y-1">
                    {cell.materiel.filter((m) => m.trim()).map((m, i) => (
                      <li key={i} className="flex gap-2 text-[15px] text-[#2B2A26]"><span style={{ color: COLORS.marine }}>•</span>{m}</li>
                    ))}
                  </ul>
                </>
              )}
              {cell.remarques && <p className="text-sm text-[#7A7362] italic mt-4">{cell.remarques}</p>}
            </div>
            {activiteNecessiteBingo(cell.activite) && (
              <BingoPrintPage nomActivite={cell.activite} theme={theme} mots={bingoMots[key]} />
            )}
            </React.Fragment>
          ))}

          <div className="no-print flex flex-wrap justify-end gap-2 pb-6">
            <button onClick={openPrintableInNewTab} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: COLORS.moss }}>
              <Printer size={14} /> Télécharger la version imprimable
            </button>
            <button
              onClick={async () => {
                setSavingBiblio(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase.from("library_items").insert({
                    user_id: user.id,
                    title: theme || groupeNom || "Sans titre",
                    payload: {
                      type: "semaine",
                      groupeNom, educatrice, semaine, theme, jours, cells,
                      periodes: visiblePeriodes,
                    },
                  });
                }
                setSavingBiblio(false);
                setBiblioSaved(true);
                setTimeout(() => setBiblioSaved(false), 2000);
              }}
              disabled={savingBiblio}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 disabled:opacity-50"
              style={{ color: COLORS.moss, borderColor: COLORS.moss }}
            >
              {savingBiblio ? "Enregistrement…" : biblioSaved ? "✓ Enregistré" : "Enregistrer dans ma bibliothèque"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= BIBLIOTHÈQUE (activités sauvegardées) =================
function BibliothequeView({ onBack }) {
  const [libraryName, setLibraryName] = useState("Ma bibliothèque");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: settings } = await supabase.from("user_settings").select("library_name").eq("user_id", user.id).maybeSingle();
      if (settings?.library_name) setLibraryName(settings.library_name);
      const { data: libItems } = await supabase.from("library_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setItems(libItems || []);
      setLoading(false);
    })();
  }, []);

  const saveLibraryName = async (name) => {
    setLibraryName(name);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_settings").upsert({ user_id: user.id, library_name: name, updated_at: new Date().toISOString() });
  };

  const removeItem = async (id) => {
    setItems((cur) => cur.filter((i) => i.id !== id));
    await supabase.from("library_items").delete().eq("id", id);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-[#7A7362] hover:text-[#7C9070]">
        <ChevronLeft size={16} /> Retour
      </button>

      <div className="max-w-md">
        <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Nom de votre bibliothèque</label>
        <div className="mt-1">
          <input
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            onBlur={(e) => saveLibraryName(e.target.value)}
            className="w-full bg-white border border-[#DCD3C2] rounded-lg px-3 py-2 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-[#7C9070]"
            style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#7A7362]">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#7A7362]">
          Aucune planification enregistrée pour l'instant. Depuis l'aperçu imprimable, cliquez « Enregistrer dans ma bibliothèque » pour en ajouter une.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((item) => {
            const isOpen = expandedId === item.id;
            const p = item.payload || {};
            const keptList = Array.isArray(p.kept) ? p.kept : null;
            const joursList = Array.isArray(p.jours) ? p.jours : null;
            const computedRowsList = Array.isArray(p.computedRows) ? p.computedRows : null;
            const groupsList = Array.isArray(p.groups) ? p.groups : null;
            return (
              <div key={item.id} className={`bg-white border border-[#E3DACB] rounded-2xl p-4 ${isOpen ? "sm:col-span-2" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>{item.title}</h4>
                  <button onClick={() => removeItem(item.id)} className="text-[#B3A990] hover:text-[#10192B] shrink-0"><Trash2 size={14} /></button>
                </div>
                <p className="text-xs text-[#7A7362] mt-1">
                  Enregistrée le {new Date(item.created_at).toLocaleDateString("fr-CA")}
                </p>
                <button
                  onClick={() => setExpandedId(isOpen ? null : item.id)}
                  className="mt-2 text-xs font-semibold text-[#7C9070] hover:underline"
                >
                  {isOpen ? "▲ Cacher le contenu" : "▼ Voir le contenu"}
                </button>
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-[#EDE6D8] space-y-4">
                    {p.dateLabel && <p className="text-xs text-[#7A7362]">Date : {p.dateLabel}</p>}
                    {(p.educatrice || p.semaine) && (
                      <p className="text-xs text-[#7A7362]">
                        {p.educatrice && <>Éducateur·trice : <strong>{p.educatrice}</strong> </>}
                        {p.semaine && <> · Semaine : <strong>{p.semaine}</strong></>}
                      </p>
                    )}
                    {computedRowsList && computedRowsList.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.moss }}>Horaire de la journée</p>
                        <div className="border border-[#EDE6D8] rounded-xl overflow-hidden overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ background: COLORS.moss }}>
                                <th className="text-left text-white font-bold p-2 whitespace-nowrap">Heure</th>
                                {(groupsList || []).map((g, gi) => (
                                  <th key={gi} className="text-left text-white font-bold p-2">{g}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {computedRowsList.map((row, ri) => {
                                if (row.type === "rotation") {
                                  return (
                                    <tr key={ri} className="border-t border-[#EDE6D8]">
                                      <td className="p-2 font-semibold whitespace-nowrap">{row.time}</td>
                                      {(row.cells || []).map((c, ci) => (
                                        <td key={ci} className="p-2">
                                          {c?.nom}
                                          {c?.lieu && <div className="text-[#7A7362]">{c.lieu}</div>}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                }
                                if (row.type === "diner") {
                                  return (
                                    <tr key={ri} className="border-t border-[#EDE6D8]" style={{ background: "#FBF3E4" }}>
                                      <td className="p-2 font-semibold whitespace-nowrap">{row.time}</td>
                                      {(groupsList || []).map((_, gi) => (
                                        <td key={gi} className="p-2">{row.labels?.[gi] || ""}</td>
                                      ))}
                                    </tr>
                                  );
                                }
                                return (
                                  <tr key={ri} className="border-t border-[#EDE6D8]">
                                    <td className="p-2 font-semibold whitespace-nowrap">{row.time}</td>
                                    <td className="p-2" colSpan={(groupsList || []).length}>{row.label}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {keptList && keptList.length > 0 && (
                      <div className="space-y-3">
                        {keptList.map((a, i) => (
                          <div key={i} className="border border-[#EDE6D8] rounded-xl p-3">
                            <p className="font-semibold text-sm">{a.nom}</p>
                            <p className="text-xs text-[#7A7362] mb-1.5">{[a.lieu, a.age, a.duree].filter(Boolean).join(" · ")}</p>
                            {a.amorce && <p className="text-xs italic mb-1.5">{a.amorce}</p>}
                            {a.deroulement?.length > 0 && (
                              <ol className="text-xs space-y-0.5 mb-1.5">
                                {a.deroulement.map((d, di) => <li key={di}>{di + 1}. {d}</li>)}
                              </ol>
                            )}
                            {a.materiel?.length > 0 && (
                              <p className="text-xs text-[#7A7362]">Matériel : {a.materiel.join(", ")}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {joursList && joursList.length > 0 && (
                      <div className="space-y-3">
                        {joursList.map((j, i) => {
                          const dayCells = p.cells
                            ? Object.entries(p.cells).filter(([key]) => key.startsWith(`${j.name}__`))
                            : [];
                          return (
                            <div key={i} className="border border-[#EDE6D8] rounded-xl p-3">
                              <p className="font-semibold text-sm">{j.name}{j.lieu && <span className="font-normal text-xs text-[#7A7362]"> — {j.lieu}</span>}</p>
                              {dayCells.map(([key, cell], ci) => cell?.activite && (
                                <div key={ci} className="mt-2 pt-2 border-t border-[#EDE6D8] first:mt-0 first:pt-0 first:border-0">
                                  <p className="text-sm font-medium">{cell.activite}</p>
                                  <p className="text-xs text-[#7A7362] mb-1">{[cell.local, cell.duree].filter(Boolean).join(" · ")}</p>
                                  {cell.amorce && <p className="text-xs italic mb-1">{cell.amorce}</p>}
                                  {cell.description && (
                                    <ol className="text-xs space-y-0.5 mb-1">
                                      {cell.description.split("\n").filter((l) => l.trim()).map((d, di) => <li key={di}>{di + 1}. {d}</li>)}
                                    </ol>
                                  )}
                                  {cell.materiel?.filter((m) => m.trim()).length > 0 && (
                                    <p className="text-xs text-[#7A7362]">Matériel : {cell.materiel.filter((m) => m.trim()).join(", ")}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!keptList && !joursList && (
                      <p className="text-xs text-[#B3A990]">Aucun détail disponible pour cette planification.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
