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
// like an "amorce" (activity intro/hook), où le JSON serait superflu.
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

function buildSinglePrompt({ theme, ages, lieux, avoidNames, isMercredi }) {
  return `Tu conçois des activités pour des journées pédagogiques en milieu scolaire (élèves du primaire).

Thème : "${theme}"
Groupes d'âge : ${ages.length ? ages.join(", ") : "4-12 ans"}
Lieux disponibles : ${lieux.length ? lieux.join(", ") : "à déterminer"}
${agesInstruction(ages)}
Propose UNE nouvelle idée d'activité, différente de celles-ci : ${avoidNames.join(", ") || "aucune"}.
IMPORTANT : ${isMercredi ? "l'activité doit durer 30 MINUTES MAXIMUM (c'est le temps alloué par bloc de rotation)." : "l'activité doit durer 60 minutes MAXIMUM (idéalement 30 à 60 minutes)."}
Écris aussi une courte amorce (3 à 5 phrases, à dire directement aux enfants) pour capter leur attention et introduire l'activité de façon vivante.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, format exact :
{
  "nom": "Nom court",
  "lieu": "Un des lieux fournis",
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
  return { addFixe, addRotation, addDiner, remove, update, updateLabelAt, move };
}

// ---------- small atoms ----------
function TextField({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-white border border-[#DCD3C2] rounded-lg px-3 py-2 text-[15px] text-[#2B2A26] placeholder-[#B3A990] focus:outline-none focus:ring-2 focus:ring-[#3C6E52] focus:border-transparent ${className}`}
    />
  );
}
function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
        active ? "text-white border-transparent" : "text-[#7A7362] border-[#DCD3C2] bg-white hover:border-[#3C6E52]"
      }`}
      style={active ? { background: COLORS.moss } : {}}
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
    <button onClick={onClick} title={title} className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${danger ? "hover:bg-red-50 text-red-500" : "hover:bg-[#E4EEE4] text-[#3C6E52]"}`}>
      {children}
    </button>
  );
}

// ================= APP =================
export default function App() {
  const [tab, setTab] = useState("idees"); // idees | horaire | apercu
  const [showBiblio, setShowBiblio] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  // ---- generator state ----
  const [theme, setTheme] = useState("Éveil de la nature");
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
  const [activitesParMercredi, setActivitesParMercredi] = useState(1);
  const applyDayType = (key) => {
    const found = DAY_TYPES.find((d) => d.key === key);
    if (!found) return;
    setDayType(key);
    if (found.build) setScheduleRows(key === "mercredi" ? found.build(activitesParMercredi) : found.build());
    setAges(key === "mercredi" ? [...MATERNELLE_AGES] : [...AGES]);
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
    } catch (e) {
      setTransitionError(friendlyGenerationError(e, "Échec de la génération"));
    } finally {
      setLoadingTransition(false);
    }
  };
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
      const raw = await askClaude(buildBatchPrompt({
        theme, ages, lieux, count: effectiveCount,
        monthContext: isMercredi ? { mois: MOIS_NOMS[moisIndex], annee: anneeMois, nbSemaines: mercredis.length, activitesParJour: activitesParMercredi } : null,
      }), Math.min(8000, 1200 + effectiveCount * 500));
      setIdeas(raw.map((r) => ({ id: nextId(), ...r })));
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBiblio(true)}
              className="text-[13px] font-bold text-white px-4 py-2 rounded-full"
              style={{ background: COLORS.moss }}
            >
              Ma bibliothèque
            </button>
            <button
              onClick={async () => {
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
              className="text-[13px] font-bold text-[#7A7362] bg-white border border-[#E3DACB] px-4 py-2 rounded-full disabled:opacity-50"
            >
              {openingPortal ? "..." : "Gérer mon abonnement"}
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
              className="text-[13px] font-bold text-[#7A7362] bg-white border border-[#E3DACB] px-4 py-2 rounded-full"
            >
              Se déconnecter
            </button>
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
        <img src="/logo-planif-vert.png" alt="PLANIF" style={{ height: 34, width: 111, objectFit: "contain", display: "block", transform: "rotate(90deg)", transformOrigin: "center center" }} />
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
                  className="px-3 py-1.5 rounded-full text-sm font-semibold border border-[#3C6E52] bg-white w-32"
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
                className="bg-white border border-[#DCD3C2] rounded-lg px-3 py-2 text-[15px] text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#3C6E52]"
              >
                {MOIS_NOMS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <input
                type="number"
                value={anneeMois}
                onChange={(e) => setAnneeMois(Number(e.target.value) || anneeMois)}
                className="bg-white border border-[#DCD3C2] rounded-lg px-3 py-2 text-[15px] text-[#2B2A26] w-24 focus:outline-none focus:ring-2 focus:ring-[#3C6E52]"
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
            <Check size={18} className="text-[#3C6E52]" /> Retenues pour la journée ({kept.length})
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
            className="w-4 h-4 rounded accent-[#3C6E52]"
          />
          <span className="font-semibold" style={{ fontFamily: "Baloo 2, sans-serif" }}>Fiches de transition <span className="font-normal text-xs text-[#7A7362]">(coloriages et mots cachés)</span></span>
        </label>
        {transitionEnabled && (
          <div className="mt-3 ml-6">
            <button
              onClick={generateTransition}
              disabled={loadingTransition || !theme.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
              style={{ background: COLORS.moss }}
            >
              {loadingTransition ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {loadingTransition ? "Génération en cours…" : transitionData ? "Régénérer" : "Générer les fiches"}
            </button>
            {transitionError && <p className="text-sm mt-2" style={{ color: COLORS.danger }}>{transitionError}</p>}
            {transitionData && !transitionError && (
              <div className="mt-3 p-3 rounded-lg border border-[#E3DACB] bg-white">
                <p className="text-xs font-bold text-[#3C6E52] mb-2">✓ Prêtes — s'ajouteront à l'aperçu</p>
                <p className="text-xs text-[#7A7362] mb-2">Mots cachés et coloriage.</p>
                {transitionData.imagePrompts?.length > 0 && (
                  <div className="pt-2 border-t border-[#EDE6D8]">
                    <p className="text-xs font-bold text-[#7A7362] mb-1">Pour un vrai coloriage illustré :</p>
                    <p className="text-xs text-[#7A7362] mb-2">Sur educol.net, entrez une description du dessin voulu (ex. « un renard curieux dans une forêt d'automne ») pour obtenir un coloriage prêt à imprimer.</p>
                    {transitionData.imagePrompts.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#FBF3E4] rounded px-2 py-1 mt-1">
                        <p className="text-xs text-[#2B2A26] italic flex-1">« {p} »</p>
                        <button onClick={() => navigator.clipboard.writeText(p)} className="text-[10px] font-bold text-[#3C6E52] bg-white border border-[#DCD3C2] rounded px-2 py-1 shrink-0">Copier</button>
                      </div>
                    ))}
                    <a href="https://educol.net" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: COLORS.moss }}>
                      Ouvrir educol.net ↗
                    </a>
                    <div className="mt-2">
                      <label className="text-xs font-semibold text-[#3C6E52] cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCD3C2] hover:border-[#3C6E52]">
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
        <button onClick={onEdit} className="shrink-0 text-[#B3A990] hover:text-[#3C6E52]" title="Modifier"><Pencil size={15} /></button>
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
            <textarea value={idea.amorce} onChange={(e) => onUpdate({ amorce: e.target.value })} rows={3} className="w-full bg-white border border-[#DCD3C2] rounded-lg px-2.5 py-1.5 text-sm text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#3C6E52]" />
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
        {isEditing && <button onClick={() => onAddListItem("deroulement")} className="mt-1 text-xs font-semibold text-[#3C6E52] flex items-center gap-1"><Plus size={12} /> Étape</button>}
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
                  <button onClick={() => onRemoveListItem("materiel", i)} className="text-[#B3A990] hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              ) : <span>{m}</span>}
            </li>
          ))}
        </ul>
        {isEditing && <button onClick={() => onAddListItem("materiel")} className="mt-1 text-xs font-semibold text-[#3C6E52] flex items-center gap-1"><Plus size={12} /> Item</button>}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-2 border-t border-[#EDE6D8]">
        {isKept ? (
          <button onClick={onUnkeep} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#E4EEE4] text-[#3C6E52]"><Check size={14} /> Retenue</button>
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
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Bâtir l'horaire</h1>
        <p className="text-[#7A7362] mt-1 max-w-2xl">
          Une seule liste, dans l'ordre réel de la journée. Les blocs « Rotation » se remplissent
          automatiquement avec les {kept.length} activité{kept.length > 1 ? "s" : ""} retenue{kept.length > 1 ? "s" : ""}.
          Réordonnez avec les flèches, modifiez les heures et libellés, ou ajoutez des blocs.
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
        <button onClick={addGroup} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[#3C6E52] hover:underline"><Plus size={15} /> Ajouter un groupe</button>
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

        <div className="space-y-2">
          {scheduleRows.map((row, idx) => (
            <ScheduleRowEditor
              key={row.id}
              row={row}
              groups={groups}
              isFirst={idx === 0}
              isLast={idx === scheduleRows.length - 1}
              ops={scheduleOps}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={scheduleOps.addFixe} className="flex items-center gap-1.5 text-sm font-semibold text-[#3C6E52] border border-[#DCD3C2] rounded-lg px-3 py-1.5 hover:border-[#3C6E52]">
            <Plus size={14} /> Bloc fixe
          </button>
          <button onClick={scheduleOps.addRotation} className="flex items-center gap-1.5 text-sm font-semibold text-[#3C6E52] border border-[#DCD3C2] rounded-lg px-3 py-1.5 hover:border-[#3C6E52]">
            <Plus size={14} /> Plage de rotation
          </button>
          <button onClick={scheduleOps.addDiner} className="flex items-center gap-1.5 text-sm font-semibold text-[#3C6E52] border border-[#DCD3C2] rounded-lg px-3 py-1.5 hover:border-[#3C6E52]">
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

function ScheduleRowEditor({ row, groups, isFirst, isLast, ops }) {
  return (
    <div className="border border-[#E3DACB] rounded-xl p-3 bg-white/60">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 pt-1">
          <button disabled={isFirst} onClick={() => ops.move(row.id, -1)} className="text-[#B3A990] hover:text-[#3C6E52] disabled:opacity-30">
            <ChevronRight size={14} style={{ transform: "rotate(-90deg)" }} />
          </button>
          <button disabled={isLast} onClick={() => ops.move(row.id, 1)} className="text-[#B3A990] hover:text-[#3C6E52] disabled:opacity-30">
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
    const headerCells = groups.map((g) => `<th style="text-align:left;padding:10px;background:#3C6E52;color:white;font-size:11px;text-transform:uppercase;">${escapeHtml(g)}</th>`).join("");
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
      monthlyHtml = `<p style="color:#10192B;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Horaire mensuelle</p>
<h1 style="color:#2A4E3B;margin:4px 0 12px;">${escapeHtml(theme) || "Thème du mois"}</h1>
<table style="margin-bottom:24px;"><thead><tr><th style="text-align:left;padding:10px;background:#3C6E52;color:white;font-size:11px;text-transform:uppercase;">Date</th><th style="text-align:left;padding:10px;background:#3C6E52;color:white;font-size:11px;text-transform:uppercase;">Activité</th></tr></thead><tbody>${monthlyRows}</tbody></table>
<div style="page-break-before:always;"></div>`;
    }

    const fichesHtml = kept.map((st) => {
      const etapes = (st.deroulement || []).map((l, i) => `<li style="margin-bottom:6px;">${i + 1}. ${escapeHtml(l)}</li>`).join("");
      const materiel = (st.materiel || []).map((m) => `<li style="margin-bottom:4px;">• ${escapeHtml(m)}</li>`).join("");
      return `<div style="page-break-before:always;padding:24px 0;">
        <p style="color:#10192B;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(st.lieu || "Plateau")}</p>
        <h2 style="color:#2A4E3B;margin:4px 0 12px;">${escapeHtml(st.nom)}</h2>
        <p style="color:#7A7362;">${escapeHtml(st.age)} · ${escapeHtml(st.duree)}</p>
        ${st.amorce ? `<h3 style="color:#3C6E52;font-size:13px;text-transform:uppercase;margin-top:16px;">Amorce</h3><p style="font-style:italic;">${escapeHtml(st.amorce)}</p>` : ""}
        ${etapes ? `<h3 style="color:#3C6E52;font-size:13px;text-transform:uppercase;margin-top:16px;">Déroulement</h3><ol style="padding-left:18px;">${etapes}</ol>` : ""}
        ${materiel ? `<h3 style="color:#3C6E52;font-size:13px;text-transform:uppercase;margin-top:16px;">Matériel</h3><ul style="list-style:none;padding-left:0;">${materiel}</ul>` : ""}
      </div>`;
    }).join("");

    const logoUrl = `${window.location.origin}/logo-planif-vert.png`;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(theme) || "Planification"}</title>
<style>body{font-family:-apple-system,Nunito,sans-serif;color:#2B2A26;margin:24px;}table{width:100%;border-collapse:collapse;}.print-logo{position:fixed;bottom:8mm;left:8mm;height:12mm;width:auto;opacity:0.9;}@media print{@page{margin:12mm;}}</style></head><body>
<img src="${logoUrl}" class="print-logo" alt="PLANIF" />
${monthlyHtml}
<p style="color:#10192B;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Horaire de la journée</p>
<h1 style="color:#2A4E3B;margin:4px 0 12px;">${escapeHtml(theme) || "Thème de la journée"}</h1>
${dateLabel ? `<p style="color:#7A7362;">${escapeHtml(dateLabel)}</p>` : ""}
<table style="margin-top:16px;"><thead><tr><th style="text-align:left;padding:10px;background:#3C6E52;color:white;font-size:11px;text-transform:uppercase;">Heure</th>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table>
${materialList.length ? `<h2 style="color:#2A4E3B;margin-top:24px;">Matériel</h2><ul style="list-style:none;padding-left:0;">${materialHtml}</ul>` : ""}
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
      <button onClick={onBack} className="no-print flex items-center gap-1.5 text-sm font-semibold text-[#7A7362] hover:text-[#3C6E52] mb-4">
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
        <div key={st.id} className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-8 mb-8" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
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
                payload: { theme, dateLabel, kept },
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

  const [educatrice, setEducatrice] = useState("");
  const [semaine, setSemaine] = useState("");
  const [groupeNom, setGroupeNom] = useState("");
  const [wAges, setWAges] = useState(["4-6 ans", "7-9 ans", "10-12 ans"]);
  const [theme, setTheme] = useState("");

  const [jours, setJours] = useState(() => ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map((name) => ({ id: nextId(), name, lieu: "" })));
  const [savingLieux, setSavingLieux] = useState(false);
  const [lieuxSaved, setLieuxSaved] = useState(false);
  const [savingBiblio, setSavingBiblio] = useState(false);
  const [biblioSaved, setBiblioSaved] = useState(false);
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
    } catch (e) {
      setTransitionError(friendlyGenerationError(e, "Échec de la génération"));
    } finally {
      setLoadingTransition(false);
    }
  };

  const getCell = (jour, periode) => cells[weeklyCellKey(jour, periode)] || weeklyEmptyCell();
  const setCell = (jour, periode, patch) =>
    setCells((cur) => ({ ...cur, [weeklyCellKey(jour, periode)]: { ...getCell(jour, periode), ...patch } }));
  const toggleDomaine = (jour, periode, domaine) => {
    const cell = getCell(jour, periode);
    const has = cell.domaines.includes(domaine);
    setCell(jour, periode, { domaines: has ? cell.domaines.filter((d) => d !== domaine) : [...cell.domaines, domaine] });
  };

  const addJour = () => setJours((j) => [...j, { id: nextId(), name: "Nouveau jour", lieu: "" }]);
  const removeJour = (idx) => setJours((j) => j.filter((_, i) => i !== idx));
  const renameJour = (idx, val) => setJours((j) => j.map((x, i) => (i === idx ? { ...x, name: val } : x)));
  const renameJourLieu = (idx, val) => setJours((j) => j.map((x, i) => (i === idx ? { ...x, lieu: val } : x)));

  const addPeriode = () => { setPeriodes((p) => [...p, "Nouvelle période"]); setSelectedPeriodes((p) => [...p, "Nouvelle période"]); };
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
        return `<td style="padding:10px;vertical-align:top;border-bottom:1px solid #EDE6D8;"><div style="font-weight:700;">${escapeHtml(cell.activite) || "—"}</div><div style="font-size:12px;color:#7A7362;">${escapeHtml([cell.local || jourObj.lieu, cell.duree].filter(Boolean).join(" · "))}</div>${cell.resume ? `<div style="font-size:12px;color:#2B2A26;margin-top:2px;">${escapeHtml(cell.resume)}</div>` : ""}${cell.materiel?.filter((m) => m.trim()).length ? `<div style="font-size:12px;color:#7A7362;margin-top:2px;">Matériel : ${escapeHtml(cell.materiel.filter((m) => m.trim()).join(", "))}</div>` : ""}${cell.domaines.length ? `<div style="font-size:12px;color:#3C6E52;margin-top:2px;">${escapeHtml(cell.domaines.join(" · "))}</div>` : ""}</td>`;
      }).join("");
      return `<tr><td style="padding:10px;vertical-align:top;border-bottom:1px solid #EDE6D8;font-weight:700;white-space:nowrap;">${escapeHtml(jourObj.name)}${jourObj.lieu ? `<div style="font-weight:400;font-size:12px;color:#7A7362;">${escapeHtml(jourObj.lieu)}</div>` : ""}</td>${c}</tr>`;
    }).join("");
    const headerCells = visiblePeriodes.map((p) => `<th style="text-align:left;padding:10px;background:#3C6E52;color:white;font-size:11px;text-transform:uppercase;">${escapeHtml(p)}</th>`).join("");

    const fichesHtml = [];
    jours.forEach((jourObj) => visiblePeriodes.forEach((periode) => {
      const c = getCell(jourObj.name, periode);
      if (!c.activite?.trim()) return;
      const etapes = (c.description || "").split("\n").filter((l) => l.trim()).map((l, i) => `<li style="margin-bottom:6px;">${i + 1}. ${escapeHtml(l)}</li>`).join("");
      const materiel = (c.materiel || []).filter((m) => m.trim()).map((m) => `<li style="margin-bottom:4px;">• ${escapeHtml(m)}</li>`).join("");
      fichesHtml.push(`<div style="page-break-before:always;padding:24px 0;">
        <p style="color:#10192B;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(jourObj.name)} · ${escapeHtml(periode)}${c.local ? " · " + escapeHtml(c.local) : ""}${c.duree ? " · " + escapeHtml(c.duree) : ""}</p>
        <h2 style="color:#2A4E3B;margin:4px 0 12px;">${escapeHtml(c.activite)}</h2>
        ${c.domaines.length ? `<p style="color:#7A7362;">${c.domaines.map(escapeHtml).join(" · ")}</p>` : ""}
        ${c.amorce ? `<h3 style="color:#3C6E52;font-size:13px;text-transform:uppercase;margin-top:16px;">Amorce</h3><p style="font-style:italic;">${escapeHtml(c.amorce)}</p>` : ""}
        ${etapes ? `<h3 style="color:#3C6E52;font-size:13px;text-transform:uppercase;margin-top:16px;">Déroulement</h3><ol style="padding-left:18px;">${etapes}</ol>` : ""}
        ${materiel ? `<h3 style="color:#3C6E52;font-size:13px;text-transform:uppercase;margin-top:16px;">Matériel</h3><ul style="list-style:none;padding-left:0;">${materiel}</ul>` : ""}
        ${c.remarques ? `<p style="color:#7A7362;font-style:italic;margin-top:12px;">${escapeHtml(c.remarques)}</p>` : ""}
      </div>`);
    }));

    const logoUrl = `${window.location.origin}/logo-planif-vert.png`;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Grille de planification — SDG</title>
<style>body{font-family:-apple-system,Nunito,sans-serif;color:#2B2A26;margin:24px;}table{width:100%;border-collapse:collapse;}.print-logo{position:fixed;bottom:8mm;left:8mm;height:12mm;width:auto;opacity:0.9;}@media print{@page{size:landscape;margin:12mm;}}</style></head><body>
<img src="${logoUrl}" class="print-logo" alt="PLANIF" />
<p style="color:#10192B;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Résumé de la semaine</p>
<h1 style="color:#2A4E3B;margin:4px 0 12px;">Grille de planification — SDG</h1>
<p style="color:#7A7362;">Groupe : <strong>${escapeHtml(groupeNom) || "—"}</strong> &nbsp;|&nbsp; Éducateur·trice : <strong>${escapeHtml(educatrice) || "—"}</strong> &nbsp;|&nbsp; Semaine : <strong>${escapeHtml(semaine) || "—"}</strong> &nbsp;|&nbsp; Thème : <strong>${escapeHtml(theme) || "—"}</strong></p>
<table style="margin-top:16px;"><thead><tr><th style="text-align:left;padding:10px;background:#3C6E52;color:white;font-size:11px;text-transform:uppercase;">Jour</th>${headerCells}</tr></thead><tbody>${rows}</tbody></table>
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
                <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Thème du mois</label>
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
              <button onClick={addJour} className="flex items-center gap-1 text-sm font-semibold text-[#3C6E52]"><Plus size={14} /> Jour</button>
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
                    <input type="checkbox" checked={selectedPeriodes.includes(p)} onChange={() => togglePeriodeSelected(p)} className="w-4 h-4 accent-[#3C6E52]" />
                    <input value={p} onChange={(e) => renamePeriode(idx, e.target.value)} className="text-sm w-28 focus:outline-none" />
                  </label>
                  <IconBtn danger title="Retirer" onClick={() => removePeriode(idx)}><Trash2 size={13} /></IconBtn>
                </div>
              ))}
              <button onClick={addPeriode} className="flex items-center gap-1 text-sm font-semibold text-[#3C6E52] px-2"><Plus size={14} /> Période</button>
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
                              className="text-[#3C6E52] hover:text-[#2A4E3B] disabled:opacity-40"
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
                                style={cell.domaines.includes(d) ? { background: COLORS.sun } : {}}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                          <TextField value={cell.remarques} onChange={(v) => setCell(jourObj.name, periode, { remarques: v })} placeholder="Moyens / remarques" />

                          <button onClick={() => setExpandedCell(expandedCell === key ? null : key)} className="mt-2 text-xs font-semibold text-[#3C6E52] hover:underline">
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
                                  className="w-full bg-white border border-[#DCD3C2] rounded-lg px-2.5 py-1.5 text-sm text-[#2B2A26] focus:outline-none focus:ring-2 focus:ring-[#3C6E52]"
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
                                className="w-full bg-white border border-[#DCD3C2] rounded-lg px-2.5 py-1.5 text-sm text-[#2B2A26] placeholder-[#B3A990] focus:outline-none focus:ring-2 focus:ring-[#3C6E52]"
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
                                <button onClick={() => setCell(jourObj.name, periode, { materiel: [...cell.materiel, ""] })} className="flex items-center gap-1 text-xs font-semibold text-[#3C6E52]">
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
                className="w-4 h-4 rounded accent-[#3C6E52]"
              />
              <span className="font-semibold" style={{ fontFamily: "Baloo 2, sans-serif" }}>Fiches de transition <span className="font-normal text-xs text-[#7A7362]">(coloriages et mots cachés)</span></span>
            </label>
            {transitionEnabled && (
              <div className="mt-3 ml-6">
                {!transitionData && (
                  <button
                    onClick={generateTransition}
                    disabled={loadingTransition || !theme.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                    style={{ background: COLORS.moss }}
                  >
                    {loadingTransition && <Loader2 size={15} className="animate-spin" />}
                    {loadingTransition ? "Génération en cours…" : "Générer les fiches"}
                  </button>
                )}
                {transitionError && <p className="text-sm mt-2" style={{ color: COLORS.danger }}>{transitionError}</p>}
                {transitionData && !transitionError && (
                  <div className="mt-3 p-3 rounded-lg border border-[#E3DACB] bg-white">
                    <p className="text-xs font-bold text-[#3C6E52] mb-2">✓ Prêtes — s'ajouteront à l'aperçu</p>
                    <p className="text-xs text-[#7A7362] mb-2">Mots cachés et coloriage.</p>
                    {transitionData.imagePrompts?.length > 0 && (
                      <div className="pt-2 border-t border-[#EDE6D8]">
                        <p className="text-xs font-bold text-[#7A7362] mb-1">Pour un vrai coloriage illustré :</p>
                        <p className="text-xs text-[#7A7362] mb-2">Sur educol.net, entrez une description du dessin voulu (ex. « un renard curieux dans une forêt d'automne ») pour obtenir un coloriage prêt à imprimer.</p>
                        {transitionData.imagePrompts.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 bg-[#FBF3E4] rounded px-2 py-1 mt-1">
                            <p className="text-xs text-[#2B2A26] italic flex-1">« {p} »</p>
                            <button onClick={() => navigator.clipboard.writeText(p)} className="text-[10px] font-bold text-[#3C6E52] bg-white border border-[#DCD3C2] rounded px-2 py-1 shrink-0">Copier</button>
                          </div>
                        ))}
                        <a href="https://educol.net" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background: COLORS.moss }}>
                          Ouvrir educol.net ↗
                        </a>
                        <div className="mt-2">
                          <label className="text-xs font-semibold text-[#3C6E52] cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCD3C2] hover:border-[#3C6E52]">
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
          <button onClick={() => setWtab("configurer")} className="no-print flex items-center gap-1.5 text-sm font-semibold text-[#7A7362] hover:text-[#3C6E52] mb-4">
            <ChevronLeft size={16} /> Retour
          </button>
          {visiblePeriodes.length > 0 && (
            <div className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-6 sm:p-8 mb-6" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.marine }}>Résumé de la semaine</p>
              <h1 className="text-2xl font-bold mt-1" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>Grille de planification — SDG</h1>
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
                            <div className="font-semibold">{cell.activite || "—"}</div>
                            {(cell.local || cell.duree) && (
                              <div className="text-xs text-[#7A7362]">{[cell.local, cell.duree].filter(Boolean).join(" · ")}</div>
                            )}
                            {cell.resume && <div className="text-xs text-[#2B2A26] mt-1">{cell.resume}</div>}
                            {cell.materiel?.filter((m) => m.trim()).length > 0 && (
                              <div className="text-xs text-[#7A7362] mt-1">Matériel : {cell.materiel.filter((m) => m.trim()).join(", ")}</div>
                            )}
                            {cell.domaines.length > 0 && (
                              <div className="text-xs mt-1" style={{ color: COLORS.moss }}>{cell.domaines.join(" · ")}</div>
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
            <div key={key} className="print-page bg-white border border-[#E3DACB] print-shadow-off rounded-2xl p-6 sm:p-8 mb-6" style={{ boxShadow: "0 1px 3px rgba(43,42,38,0.06)" }}>
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
                    payload: { groupeNom, educatrice, semaine, theme, jours, cells },
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
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-[#7A7362] hover:text-[#3C6E52]">
        <ChevronLeft size={16} /> Retour
      </button>

      <div className="max-w-md">
        <label className="text-xs font-semibold text-[#7A7362] uppercase tracking-wide">Nom de votre bibliothèque</label>
        <div className="mt-1">
          <input
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            onBlur={(e) => saveLibraryName(e.target.value)}
            className="w-full bg-white border border-[#DCD3C2] rounded-lg px-3 py-2 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-[#3C6E52]"
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
            return (
              <div key={item.id} className={`bg-white border border-[#E3DACB] rounded-2xl p-4 ${isOpen ? "sm:col-span-2" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold" style={{ fontFamily: "Baloo 2, sans-serif", color: COLORS.mossDark }}>{item.title}</h4>
                  <button onClick={() => removeItem(item.id)} className="text-[#B3A990] hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                </div>
                <p className="text-xs text-[#7A7362] mt-1">
                  Enregistrée le {new Date(item.created_at).toLocaleDateString("fr-CA")}
                </p>
                <button
                  onClick={() => setExpandedId(isOpen ? null : item.id)}
                  className="mt-2 text-xs font-semibold text-[#3C6E52] hover:underline"
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
