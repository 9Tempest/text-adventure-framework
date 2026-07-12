import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { AudioManager } from "./engine/audio";
import { getDefaultStoryEntry, loadGameContent, loadStoryCatalog } from "./engine/loader";
import { createDebugLoggerPlugin } from "./engine/plugins";
import { RuntimeEngine, type RuntimeHistoryEntry, type RuntimeLineHistoryEntry, type RuntimeSnapshot } from "./engine/runtime";
import { clearGameSave, loadGameSave, saveGame } from "./engine/save";
import type {
  AssetManifest,
  Character,
  LineStep,
  SceneCharacter,
  Story,
  StoryCatalog,
  StoryCatalogEntry,
  StoryNode,
  StoryPresentation,
  VariableValue
} from "./engine/schema";

type GameSession = {
  story: Story;
  assets: AssetManifest;
  engine: RuntimeEngine;
  audio: AudioManager;
  catalogEntry: StoryCatalogEntry;
};

type DrawerName = "clues" | "backlog" | null;

type ClueMeta = {
  label: string;
  description?: string;
  glyph?: string;
};

const LAYER_LABELS: Record<NonNullable<StoryNode["layer"]>, string> = {
  reality: "现实层",
  fairytale: "童话层",
  decode: "译码层",
  ending: "终局层"
};

const TONE_LABELS = {
  hope: "希望",
  bittersweet: "苦甜",
  dark: "幽暗",
  secret: "隐秘",
  failure: "失落"
} as const;

export default function App() {
  const [catalog, setCatalog] = useState<StoryCatalog | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(false);
  const [titleVisible, setTitleVisible] = useState(true);
  const [autoMode, setAutoMode] = useState(false);
  const [drawer, setDrawer] = useState<DrawerName>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const lastLineKey = useRef("");
  const loadToken = useRef(0);
  const mutedRef = useRef(false);
  const dialogueActionRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const startStory = useCallback(async (entry: StoryCatalogEntry, preferSave = true) => {
    const token = loadToken.current + 1;
    loadToken.current = token;
    setError(null);
    setMessage("");
    setSnapshot(null);
    setDrawer(null);
    setAutoMode(false);
    setTitleVisible(true);

    try {
      const { story, assets, catalogEntry } = await loadGameContent(entry);
      if (token !== loadToken.current) {
        return;
      }

      const save = preferSave ? loadGameSave(story.id) : null;
      const engine = new RuntimeEngine(story, {
        initialState: save ?? undefined,
        plugins: [createDebugLoggerPlugin(import.meta.env.DEV)]
      });
      const audio = new AudioManager(assets);
      audio.setMuted(mutedRef.current);

      audioRef.current?.dispose();
      audioRef.current = audio;
      lastLineKey.current = "";
      setSession({ story, assets, engine, audio, catalogEntry });
      setSelectedStoryId(catalogEntry.id);
      setSnapshot(engine.snapshot());
    } catch (cause) {
      if (token === loadToken.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (session) {
      session.audio.unlock();
      setSnapshot(session.engine.continue());
    }
  }, [session]);

  const handleChoice = useCallback((choiceId: string) => {
    if (session) {
      session.audio.unlock();
      const choice = snapshot?.availableChoices.find((candidate) => candidate.id === choiceId);
      if (choice) {
        setMessage(`已选择 · ${choice.text}`);
      }
      setSnapshot(session.engine.choose(choiceId));
    }
  }, [session, snapshot]);

  const handleTextTick = useCallback((speakerId: string | undefined, glyph: string) => {
    session?.audio.playTextTick(speakerId, glyph);
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const loadedCatalog = await loadStoryCatalog();
        if (cancelled) {
          return;
        }
        setCatalog(loadedCatalog);
        await startStory(getDefaultStoryEntry(loadedCatalog));
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
      loadToken.current += 1;
      audioRef.current?.dispose();
    };
  }, [startStory]);

  useEffect(() => {
    if (!session || !snapshot) {
      return;
    }

    session.audio.applySnapshot(snapshot);
    if (titleVisible) {
      session.audio.stopVoice();
      lastLineKey.current = "";
      return;
    }

    const line = snapshot.currentLine;
    const lineKey = line ? `${snapshot.nodeId}:${snapshot.stepIndex}:${line.id ?? line.text}` : "";
    if (lineKey !== lastLineKey.current) {
      lastLineKey.current = lineKey;
      session.audio.playVoice(line?.voice);
    }
  }, [session, snapshot, titleVisible]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && drawer) {
        event.preventDefault();
        setDrawer(null);
        return;
      }
      if (!snapshot || titleVisible || drawer || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isFormField(event.target)) {
        return;
      }

      if (/^[1-9]$/.test(event.key) && snapshot.availableChoices.length > 0) {
        const choice = snapshot.availableChoices[Number(event.key) - 1];
        if (choice) {
          event.preventDefault();
          handleChoice(choice.id);
        }
        return;
      }

      if (
        snapshot.currentLine &&
        (event.code === "Space" || event.code === "Enter") &&
        !isInteractiveTarget(event.target)
      ) {
        event.preventDefault();
        dialogueActionRef.current();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawer, handleChoice, snapshot, titleVisible]);

  if (error) {
    return (
      <Shell>
        <div className="status-panel status-panel--error">
          <span className="status-kicker">SIGNAL LOST</span>
          <h1>故事加载失败</h1>
          <p>{error}</p>
        </div>
      </Shell>
    );
  }

  if (!session || !snapshot) {
    return (
      <Shell>
        <div className="status-panel">
          <span className="loader-orbit" aria-hidden="true" />
          <span className="status-kicker">DECODING</span>
          <p>正在校准故事、图像与声音……</p>
        </div>
      </Shell>
    );
  }

  const activeSession = session;
  const { story, assets, catalogEntry } = activeSession;
  const currentNode = story.nodes.find((node) => node.id === snapshot.nodeId);
  const background = resolveImage(assets, snapshot.scene.background);
  const line = snapshot.currentLine;
  const speaker = line?.speaker ? findCharacter(story, line.speaker) : undefined;
  const speakerName = speaker?.name ?? line?.speaker ?? "旁白";
  const lineKey = line ? `${snapshot.nodeId}:${snapshot.stepIndex}:${line.id ?? line.text}` : "";
  const clueEntries = Object.entries(story.presentation?.clueLabels ?? {}) as Array<[string, ClueMeta]>;
  const metricEntries = Object.entries(story.presentation?.metricLabels ?? {}).slice(0, 4);
  const unlockedClues = clueEntries.filter(([key]) => isActiveValue(snapshot.variables[key])).length;
  const dialoguePaused = titleVisible || drawer !== null;

  function handleSave() {
    saveGame(activeSession.engine.exportSaveData());
    setMessage("进度已写入存档");
  }

  function handleLoad() {
    const save = loadGameSave(story.id);
    if (!save) {
      setMessage("这个故事还没有存档");
      return;
    }
    const engine = new RuntimeEngine(story, {
      initialState: save,
      plugins: [createDebugLoggerPlugin(import.meta.env.DEV)]
    });
    lastLineKey.current = "";
    activeSession.audio.unlock();
    setSession({ ...activeSession, engine });
    setSnapshot(engine.snapshot());
    setTitleVisible(false);
    setDrawer(null);
    setAutoMode(false);
    setMessage("已回到保存的时刻");
  }

  function handleNewGame() {
    clearGameSave(story.id);
    const engine = new RuntimeEngine(story, {
      plugins: [createDebugLoggerPlugin(import.meta.env.DEV)]
    });
    lastLineKey.current = "";
    setSession({ ...activeSession, engine });
    setSnapshot(engine.snapshot());
    setTitleVisible(true);
    setDrawer(null);
    setAutoMode(false);
    setMessage("");
  }

  function handleStoryChange(storyId: string) {
    const entry = catalog?.stories.find((storyEntry) => storyEntry.id === storyId);
    if (entry) {
      void startStory(entry);
    }
  }

  function handleMuteToggle() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    activeSession.audio.setMuted(nextMuted);
    if (!nextMuted) {
      activeSession.audio.unlock();
    }
    setMessage(nextMuted ? "声音已静默" : "声音已恢复");
  }

  function handleAutoToggle() {
    const nextAutoMode = !autoMode;
    if (nextAutoMode) {
      activeSession.audio.unlock();
    }
    setAutoMode(nextAutoMode);
    setMessage(nextAutoMode ? "自动播放已开启 · 文本音持续" : "自动播放已关闭");
  }

  return (
    <Shell>
      <main
        className={`stage transition-${snapshot.scene.transition ?? "fade"} layer-${currentNode?.layer ?? "neutral"}`}
      >
        <SceneBackdrop url={background?.src ?? null} />
        <div className="stage-atmosphere" aria-hidden="true" />
        <div className="stage-grain" aria-hidden="true" />

        <div className="character-layer" aria-hidden="true">
          {snapshot.scene.characters.map((character) => (
            <CharacterSprite
              key={`${character.slot}:${character.character}:${character.image}`}
              character={character}
              story={story}
              assets={assets}
            />
          ))}
        </div>

        <Hud
          story={story}
          node={currentNode}
          snapshot={snapshot}
          metricEntries={metricEntries}
          clueCount={unlockedClues}
          clueTotal={clueEntries.length}
          autoMode={autoMode}
          muted={muted}
          message={message}
          stories={catalog?.stories ?? [catalogEntry]}
          selectedStoryId={selectedStoryId}
          onAutoToggle={handleAutoToggle}
          onClues={() => setDrawer("clues")}
          onBacklog={() => setDrawer("backlog")}
          onStoryChange={handleStoryChange}
          onSave={handleSave}
          onLoad={handleLoad}
          onNewGame={handleNewGame}
          onMuteToggle={handleMuteToggle}
        />

        <section className="play-area" aria-live="polite">
          {snapshot.ending ? (
            <EndingPanel
              node={currentNode}
              clueCount={unlockedClues}
              clueTotal={clueEntries.length}
              choiceCount={snapshot.choiceHistory.length}
              onBacklog={() => setDrawer("backlog")}
              onNewGame={handleNewGame}
            />
          ) : line ? (
            <DialoguePanel
              key={lineKey}
              line={line}
              speaker={speaker}
              speakerName={speakerName}
              portraitUrl={resolveImage(assets, line.portrait)?.src}
              autoMode={autoMode}
              paused={dialoguePaused}
              actionRef={dialogueActionRef}
              highlightTerms={story.presentation?.highlightTerms ?? {}}
              onTextTick={handleTextTick}
              onContinue={handleContinue}
            />
          ) : (
            <ChoicePanel
              snapshot={snapshot}
              highlightTerms={story.presentation?.highlightTerms ?? {}}
              onChoice={handleChoice}
            />
          )}
        </section>

        {titleVisible && (
          <StoryTitleScreen
            story={story}
            entry={catalogEntry}
            presentation={story.presentation}
            node={currentNode}
            snapshot={snapshot}
            onBegin={() => {
              activeSession.audio.unlock();
              setTitleVisible(false);
            }}
          />
        )}

        {drawer === "clues" && (
          <ClueDrawer
            entries={clueEntries}
            variables={snapshot.variables}
            onClose={() => setDrawer(null)}
          />
        )}

        {drawer === "backlog" && (
          <BacklogDrawer
            history={snapshot.lineHistory}
            choices={snapshot.choiceHistory}
            story={story}
            onClose={() => setDrawer(null)}
          />
        )}
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="app-shell">{children}</div>;
}

function SceneBackdrop({ url }: { url: string | null }) {
  const [layers, setLayers] = useState<[string | null, string | null]>([url, null]);
  const [activeLayer, setActiveLayer] = useState(0);
  const activeRef = useRef(0);
  const layersRef = useRef<[string | null, string | null]>([url, null]);

  useEffect(() => {
    if (url === layersRef.current[activeRef.current]) {
      return;
    }

    let cancelled = false;
    let committed = false;
    let firstFrame = 0;
    let secondFrame = 0;
    let image: HTMLImageElement | null = null;

    const commit = () => {
      if (cancelled || committed) {
        return;
      }
      committed = true;
      const nextLayer = activeRef.current === 0 ? 1 : 0;
      const nextLayers = [...layersRef.current] as [string | null, string | null];
      nextLayers[nextLayer] = url;
      layersRef.current = nextLayers;
      setLayers(nextLayers);
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          if (!cancelled) {
            activeRef.current = nextLayer;
            setActiveLayer(nextLayer);
          }
        });
      });
    };

    if (url) {
      image = new Image();
      image.onload = commit;
      image.onerror = commit;
      image.src = url;
      if (image.complete) {
        commit();
      }
    } else {
      commit();
    }

    return () => {
      cancelled = true;
      image?.removeAttribute("src");
      if (firstFrame) {
        window.cancelAnimationFrame(firstFrame);
      }
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [url]);

  return (
    <div className="scene-backdrop" aria-hidden="true">
      {layers.map((source, index) => (
        <div
          className={`scene-backdrop__layer ${index === activeLayer ? "is-active" : ""}`}
          key={index}
        >
          {source && <img src={source} alt="" draggable={false} decoding="async" />}
        </div>
      ))}
    </div>
  );
}

function Hud(props: {
  story: Story;
  node?: StoryNode;
  snapshot: RuntimeSnapshot;
  metricEntries: Array<[string, string]>;
  clueCount: number;
  clueTotal: number;
  autoMode: boolean;
  muted: boolean;
  message: string;
  stories: StoryCatalogEntry[];
  selectedStoryId: string;
  onAutoToggle: () => void;
  onClues: () => void;
  onBacklog: () => void;
  onStoryChange: (storyId: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  onMuteToggle: () => void;
}) {
  const progress = clamp(props.node?.progress ?? 0, 0, 1);
  const layerLabel = props.node?.layer ? LAYER_LABELS[props.node.layer] : "叙事层";

  return (
    <header className="hud">
      <div className="hud__upper">
        <div className="story-identity">
          <div className="story-identity__eyebrow">
            <span>{props.node?.chapter ?? props.story.presentation?.kicker ?? props.story.title}</span>
            <span className="layer-chip">{layerLabel}</span>
          </div>
          <div className="story-identity__title">{props.node?.title ?? props.story.title}</div>
          {props.node?.location && <div className="story-identity__location">⌖ {props.node.location}</div>}
        </div>

        <nav className="quick-controls" aria-label="游戏控制">
          <button
            className={`hud-button hud-button--auto ${props.autoMode ? "is-active" : ""}`}
            type="button"
            aria-pressed={props.autoMode}
            onClick={props.onAutoToggle}
          >
            <span className="control-mark">A</span>
            <span className="control-label">自动</span>
          </button>
          {props.clueTotal > 0 && (
            <button className="hud-button" type="button" onClick={props.onClues}>
              <span className="control-mark">◇</span>
              <span className="control-label">线索</span>
              <span className="control-count">{props.clueCount}/{props.clueTotal}</span>
            </button>
          )}
          <button className="hud-button" type="button" onClick={props.onBacklog}>
            <span className="control-mark">≡</span>
            <span className="control-label">回溯</span>
          </button>
          <details className="system-menu">
            <summary className="hud-button" aria-label="打开系统菜单">
              <span className="control-mark">•••</span>
              <span className="control-label">系统</span>
            </summary>
            <div className="system-popover">
              <label className="system-field">
                <span>当前故事</span>
                <select
                  value={props.selectedStoryId}
                  onChange={(event) => props.onStoryChange(event.currentTarget.value)}
                >
                  {props.stories.map((story) => (
                    <option key={story.id} value={story.id}>{story.title}</option>
                  ))}
                </select>
              </label>
              <div className="system-actions">
                <button type="button" onClick={props.onSave}><span>保存进度</span><kbd>SAVE</kbd></button>
                <button type="button" onClick={props.onLoad}><span>读取存档</span><kbd>LOAD</kbd></button>
                <button type="button" onClick={props.onMuteToggle}>
                  <span>{props.muted ? "恢复声音" : "静音"}</span><kbd>{props.muted ? "OFF" : "ON"}</kbd>
                </button>
                <button className="system-danger" type="button" onClick={props.onNewGame}>
                  <span>重新开始</span><kbd>NEW</kbd>
                </button>
              </div>
            </div>
          </details>
        </nav>
      </div>

      <div className="narrative-progress">
        <span className="narrative-progress__fill" style={{ width: `${progress * 100}%` }} />
        <span className="sr-only" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          故事进度 {Math.round(progress * 100)}%
        </span>
      </div>

      {props.metricEntries.length > 0 && (
        <MetricPanel entries={props.metricEntries} variables={props.snapshot.variables} />
      )}

      {props.message && <div className="hud-toast" role="status">{props.message}</div>}
    </header>
  );
}

function MetricPanel(props: {
  entries: Array<[string, string]>;
  variables: Record<string, VariableValue>;
}) {
  return (
    <div className="metric-grid" aria-label="叙事指标">
      {props.entries.map(([key, label]) => {
        const value = props.variables[key];
        const numericValue = typeof value === "number" ? value : value ? 1 : 0;
        const level = clamp(Math.abs(numericValue) * 16 + 7, 7, 100);
        return (
          <div className="metric" data-negative={numericValue < 0 || undefined} key={key}>
            <div className="metric__label"><span>{label}</span><strong>{formatMetricValue(value)}</strong></div>
            <span className="metric__track"><span style={{ width: `${level}%` }} /></span>
          </div>
        );
      })}
    </div>
  );
}

function DialoguePanel(props: {
  line: LineStep;
  speaker?: Character;
  speakerName: string;
  portraitUrl?: string;
  autoMode: boolean;
  paused: boolean;
  actionRef: MutableRefObject<() => void>;
  highlightTerms: NonNullable<StoryPresentation["highlightTerms"]>;
  onTextTick: (speakerId: string | undefined, glyph: string) => void;
  onContinue: () => void;
}) {
  const characters = useMemo(() => Array.from(props.line.text), [props.line.text]);
  const reducedMotion = usePrefersReducedMotion();
  const [visibleCharacters, setVisibleCharacters] = useState(() => reducedMotion ? characters.length : 0);
  const visibleRef = useRef(visibleCharacters);
  const complete = visibleCharacters >= characters.length;
  const visibleText = characters.slice(0, visibleCharacters).join("");
  const highlightedText = useMemo(
    () => renderHighlightedText(visibleText, props.highlightTerms),
    [props.highlightTerms, visibleText]
  );

  useEffect(() => {
    if (reducedMotion) {
      visibleRef.current = characters.length;
      setVisibleCharacters(characters.length);
      return;
    }
    if (props.paused || visibleRef.current >= characters.length) {
      return;
    }

    const chunk = characters.length > 150 ? 2 : 1;
    const speed = characters.length > 90 ? 18 : 26;
    const timer = window.setInterval(() => {
      const next = Math.min(characters.length, visibleRef.current + chunk);
      for (const glyph of characters.slice(visibleRef.current, next)) {
        if (!props.line.voice) {
          props.onTextTick(props.line.speaker, glyph);
        }
      }
      visibleRef.current = next;
      setVisibleCharacters(next);
      if (next >= characters.length) {
        window.clearInterval(timer);
      }
    }, speed);
    return () => window.clearInterval(timer);
  }, [characters, props.line.speaker, props.line.voice, props.onTextTick, props.paused, reducedMotion]);

  const handleActivate = useCallback(() => {
    if (visibleRef.current < characters.length) {
      visibleRef.current = characters.length;
      setVisibleCharacters(characters.length);
      return;
    }
    props.onContinue();
  }, [characters.length, props.onContinue]);

  useEffect(() => {
    props.actionRef.current = handleActivate;
    return () => {
      if (props.actionRef.current === handleActivate) {
        props.actionRef.current = () => undefined;
      }
    };
  }, [handleActivate, props.actionRef]);

  useEffect(() => {
    if (!props.autoMode || !complete || props.paused) {
      return;
    }
    const delay = Math.min(3600, Math.max(1050, 620 + characters.length * 32));
    const timer = window.setTimeout(props.onContinue, delay);
    return () => window.clearTimeout(timer);
  }, [characters.length, complete, props.autoMode, props.onContinue, props.paused]);

  return (
    <button
      className="dialogue-panel dialogue-panel--action"
      type="button"
      onClick={handleActivate}
      aria-label={`${props.speakerName}：${props.line.text}。${complete ? "继续" : "显示完整文本"}`}
    >
      {props.portraitUrl && <img className="dialogue-portrait" src={props.portraitUrl} alt="" />}
      <span className="dialogue-body">
        <span className="speaker-row">
          <span className="speaker-name" style={{ color: props.speaker?.color }}>{props.speakerName}</span>
          {props.speaker?.role && <span className="speaker-role" title={props.speaker.bio}>{props.speaker.role}</span>}
          {props.line.voice && <span className="voice-chip">VOICE</span>}
        </span>
        <span className="dialogue-text" aria-hidden="true">
          {highlightedText}
          {!complete && <span className="type-caret" />}
        </span>
        <span className="sr-only">{props.line.text}</span>
        <span className="dialogue-footer" aria-hidden="true">
          <span>{complete ? (props.autoMode ? "AUTO · 正在聆听" : "点击继续") : "点击显示完整句子"}</span>
          <span className={`continue-glyph ${complete ? "is-ready" : ""}`}>⌄</span>
        </span>
      </span>
    </button>
  );
}

function ChoicePanel(props: {
  snapshot: RuntimeSnapshot;
  highlightTerms: NonNullable<StoryPresentation["highlightTerms"]>;
  onChoice: (choiceId: string) => void;
}) {
  if (props.snapshot.availableChoices.length === 0) {
    return (
      <div className="dialogue-panel choice-panel choice-panel--empty">
        <span className="choice-kicker">NO ROUTE</span>
        <p>此刻没有可抵达的路径。</p>
      </div>
    );
  }

  return (
    <div className="dialogue-panel choice-panel">
      <div className="choice-heading">
        <span className="choice-kicker">DECISION</span>
        <span>先看清会发生什么，再作选择</span>
      </div>
      <div className="choice-list">
        {props.snapshot.availableChoices.map((choice, index) => (
          <button className="choice-button" key={choice.id} type="button" onClick={() => props.onChoice(choice.id)}>
            <kbd>{index < 9 ? index + 1 : "·"}</kbd>
            <span className="choice-copy">
              <strong>{renderHighlightedText(choice.text, props.highlightTerms)}</strong>
              {choice.hint && <small>{choice.hint}</small>}
            </span>
            <span className="choice-arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      <div className="choice-help">可按数字键 1–{Math.min(9, props.snapshot.availableChoices.length)} 选择</div>
    </div>
  );
}

function StoryTitleScreen(props: {
  story: Story;
  entry: StoryCatalogEntry;
  presentation?: StoryPresentation;
  node?: StoryNode;
  snapshot: RuntimeSnapshot;
  onBegin: () => void;
}) {
  const hasProgress = props.snapshot.choiceHistory.length > 0 || props.snapshot.lineHistory.length > 1 || props.snapshot.stepIndex > 0;
  const progress = clamp(props.node?.progress ?? 0, 0, 1);

  return (
    <section className="title-screen" role="dialog" aria-modal="true" aria-labelledby="story-title">
      <div className="title-screen__rule" aria-hidden="true" />
      <div className="title-card">
        <div className="title-card__signal"><span /> INCOMING NARRATIVE <span /></div>
        <div className="title-card__kicker">{props.presentation?.kicker ?? props.entry.description ?? "互动叙事"}</div>
        <h1 id="story-title">{props.story.title}</h1>
        {props.presentation?.synopsis && <p className="title-card__synopsis">{props.presentation.synopsis}</p>}
        {props.node?.chapter && (
          <div className="title-card__resume">
            <span>{hasProgress ? "上次抵达" : "故事起点"}</span>
            <strong>{props.node.chapter}</strong>
            {hasProgress && <small>{Math.round(progress * 100)}% 已译码</small>}
          </div>
        )}
        {props.presentation?.contentNotice && (
          <p className="content-notice"><span>内容提示</span>{props.presentation.contentNotice}</p>
        )}
        <button className="begin-button" type="button" autoFocus onClick={props.onBegin}>
          <span>{hasProgress ? "继续聆听" : "进入故事"}</span>
          <span aria-hidden="true">→</span>
        </button>
        <div className="title-card__hint">建议开启声音 · 点击对白推进 · 空格键亦可</div>
      </div>
    </section>
  );
}

function EndingPanel(props: {
  node?: StoryNode;
  clueCount: number;
  clueTotal: number;
  choiceCount: number;
  onBacklog: () => void;
  onNewGame: () => void;
}) {
  const meta = props.node?.ending;
  const tone = meta?.tone ?? "bittersweet";
  return (
    <div className={`ending-panel tone-${tone}`}>
      <div className="ending-panel__halo" aria-hidden="true" />
      <div className="ending-panel__code">ENDING {meta?.code ?? "—"}</div>
      <div className="ending-panel__tone">{TONE_LABELS[tone]}</div>
      <h2>{meta?.title ?? props.node?.title ?? "故事终点"}</h2>
      {meta?.subtitle && <p>{meta.subtitle}</p>}
      <div className="ending-stats">
        <div><strong>{props.clueCount}<small> / {props.clueTotal}</small></strong><span>译出线索</span></div>
        <div><strong>{props.choiceCount}</strong><span>关键选择</span></div>
      </div>
      <div className="ending-actions">
        <button type="button" onClick={props.onBacklog}>回看旅程</button>
        <button className="ending-primary" type="button" onClick={props.onNewGame}>从头再来</button>
      </div>
    </div>
  );
}

function ClueDrawer(props: {
  entries: Array<[string, ClueMeta]>;
  variables: Record<string, VariableValue>;
  onClose: () => void;
}) {
  const count = props.entries.filter(([key]) => isActiveValue(props.variables[key])).length;
  return (
    <OverlayDrawer title="童话译码簿" eyebrow="CLUE ARCHIVE" onClose={props.onClose}>
      <div className="drawer-summary">
        <strong>{count}</strong><span> / {props.entries.length} 条线索已显影</span>
      </div>
      <div className="clue-list">
        {props.entries.map(([key, clue], index) => {
          const unlocked = isActiveValue(props.variables[key]);
          return (
            <article className={`clue-card ${unlocked ? "is-unlocked" : "is-locked"}`} key={key}>
              <span className="clue-glyph" aria-hidden="true">{unlocked ? clue.glyph ?? "◇" : "·"}</span>
              <div>
                <span className="clue-index">CLUE {String(index + 1).padStart(2, "0")}</span>
                <h3>{unlocked ? clue.label : "尚未译出的隐喻"}</h3>
                <p>{unlocked ? clue.description ?? "这条线索已经进入你的译码记录。" : "继续聆听，在选择与回声之间寻找它。"}</p>
              </div>
            </article>
          );
        })}
        {props.entries.length === 0 && <p className="drawer-empty">这个故事没有登记独立线索。</p>}
      </div>
    </OverlayDrawer>
  );
}

function BacklogDrawer(props: {
  history: RuntimeLineHistoryEntry[];
  choices: RuntimeHistoryEntry[];
  story: Story;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const list = listRef.current;
      list?.scrollTo({ top: list.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [props.history.length, reducedMotion]);

  return (
    <OverlayDrawer title="声音回溯" eyebrow="BACKLOG" onClose={props.onClose}>
      <div className="backlog-list" ref={listRef}>
        {props.choices.length > 0 && (
          <section className="choice-history" aria-label="你的选择记录">
            <span>YOUR DECISIONS · 你的选择</span>
            {props.choices.map((entry) => {
              const node = props.story.nodes.find((candidate) => candidate.id === entry.nodeId);
              const choice = node?.choices?.find((candidate) => candidate.id === entry.choiceId);
              return (
                <div key={`${entry.nodeId}:${entry.choiceId}:${entry.at}`}>
                  <small>{node?.title ?? entry.nodeId}</small>
                  <strong>{choice?.text ?? entry.choiceId}</strong>
                </div>
              );
            })}
          </section>
        )}
        {props.history.map((entry, index) => {
          const speaker = entry.speaker ? findCharacter(props.story, entry.speaker) : undefined;
          const node = props.story.nodes.find((candidate) => candidate.id === entry.nodeId);
          return (
            <article className={`backlog-entry ${index === props.history.length - 1 ? "is-current" : ""}`} key={entry.key}>
              <div className="backlog-entry__meta">
                <span style={{ color: speaker?.color }}>{speaker?.name ?? entry.speaker ?? "旁白"}</span>
                <small>{node?.title ?? node?.chapter ?? "未命名段落"}</small>
              </div>
              <p>{renderHighlightedText(entry.text, props.story.presentation?.highlightTerms ?? {})}</p>
            </article>
          );
        })}
        {props.history.length === 0 && <p className="drawer-empty">尚未留下可回溯的声音。</p>}
      </div>
    </OverlayDrawer>
  );
}

function OverlayDrawer(props: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="overlay-root">
      <button className="overlay-dismiss" type="button" aria-label={`关闭${props.title}`} onClick={props.onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-header">
          <div><span>{props.eyebrow}</span><h2 id="drawer-title">{props.title}</h2></div>
          <button className="drawer-close" type="button" autoFocus aria-label={`关闭${props.title}`} onClick={props.onClose}>×</button>
        </header>
        <div className="drawer-content">{props.children}</div>
      </aside>
    </div>
  );
}

function CharacterSprite(props: { character: SceneCharacter; story: Story; assets: AssetManifest }) {
  const character = findCharacter(props.story, props.character.character);
  const asset = resolveImage(props.assets, props.character.image);
  if (!asset) {
    return null;
  }
  return (
    <img
      className={`character-sprite slot-${props.character.slot}`}
      src={asset.src}
      alt={character?.name ?? asset.alt ?? props.character.character}
      draggable={false}
      decoding="async"
    />
  );
}

function findCharacter(story: Story, id: string): Character | undefined {
  return story.characters.find((character) => character.id === id);
}

function resolveImage(assets: AssetManifest, id: string | null | undefined) {
  return id ? assets.images[id] : undefined;
}

function renderHighlightedText(
  text: string,
  terms: NonNullable<StoryPresentation["highlightTerms"]>
): ReactNode {
  const matchingTerms = Object.keys(terms)
    .filter((term) => text.includes(term))
    .sort((left, right) => right.length - left.length);
  if (matchingTerms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${matchingTerms.map(escapeRegExp).join("|")})`, "g");
  return text.split(pattern).map((part, index) => {
    const meta = terms[part];
    return meta ? (
      <mark
        className={`story-highlight story-highlight--${meta.tone}`}
        key={`${part}:${index}`}
        title={meta.description}
      >
        {part}
      </mark>
    ) : part;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isActiveValue(value: VariableValue | undefined) {
  return value !== undefined && value !== null && value !== false && value !== 0 && value !== "";
}

function formatMetricValue(value: VariableValue | undefined) {
  if (typeof value === "number") {
    return `${value > 0 ? "+" : ""}${value}`;
  }
  if (typeof value === "boolean") {
    return value ? "ON" : "OFF";
  }
  return value == null || value === "" ? "0" : String(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isFormField(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, select, textarea, [contenteditable='true']"));
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, a, input, select, textarea, summary, [contenteditable='true']"));
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}
