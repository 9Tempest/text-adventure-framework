import { useCallback, useEffect, useRef, useState } from "react";
import { AudioManager } from "./engine/audio";
import { getDefaultStoryEntry, loadGameContent, loadStoryCatalog } from "./engine/loader";
import { RuntimeEngine, type RuntimeSnapshot } from "./engine/runtime";
import { clearGameSave, loadGameSave, saveGame } from "./engine/save";
import { createDebugLoggerPlugin } from "./engine/plugins";
import type {
  AssetManifest,
  Character,
  SceneCharacter,
  Story,
  StoryCatalog,
  StoryCatalogEntry
} from "./engine/schema";

type GameSession = {
  story: Story;
  assets: AssetManifest;
  engine: RuntimeEngine;
  audio: AudioManager;
  catalogEntry: StoryCatalogEntry;
};

export default function App() {
  const [catalog, setCatalog] = useState<StoryCatalog | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string>("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioManager | null>(null);
  const lastLineKey = useRef<string>("");
  const loadToken = useRef(0);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const startStory = useCallback(async (entry: StoryCatalogEntry, preferSave = true) => {
    const token = loadToken.current + 1;
    loadToken.current = token;
    setError(null);
    setMessage("");
    setSnapshot(null);

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

    boot();
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
    const line = snapshot.currentLine;
    const lineKey = line ? `${snapshot.nodeId}:${snapshot.stepIndex}:${line.id ?? line.text}` : "";
    if (lineKey !== lastLineKey.current) {
      lastLineKey.current = lineKey;
      session.audio.playVoice(line?.voice);
    }
  }, [session, snapshot]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!snapshot?.currentLine) {
        return;
      }
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        handleContinue();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (error) {
    return <Shell><div className="panel error">加载失败：{error}</div></Shell>;
  }

  if (!session || !snapshot) {
    return <Shell><div className="panel">正在加载故事与资源……</div></Shell>;
  }

  const { story, assets } = session;
  const backgroundUrl = resolveImage(assets, snapshot.scene.background)?.src;
  const line = snapshot.currentLine;
  const speaker = line?.speaker ? findCharacter(story, line.speaker) : undefined;
  const speakerName = speaker?.name ?? line?.speaker ?? "旁白";

  function handleContinue() {
    if (!session) {
      return;
    }
    setSnapshot(session.engine.continue());
  }

  function handleChoice(choiceId: string) {
    if (!session) {
      return;
    }
    setSnapshot(session.engine.choose(choiceId));
  }

  function handleSave() {
    if (!session) {
      return;
    }
    saveGame(session.engine.exportSaveData());
    setMessage("已保存");
  }

  function handleLoad() {
    if (!session) {
      return;
    }
    const save = loadGameSave(session.story.id);
    if (!save) {
      setMessage("没有找到存档");
      return;
    }
    const engine = new RuntimeEngine(session.story, {
      initialState: save,
      plugins: [createDebugLoggerPlugin(import.meta.env.DEV)]
    });
    setSession({ ...session, engine });
    setSnapshot(engine.snapshot());
    setMessage("已读取存档");
  }

  function handleNewGame() {
    if (!session) {
      return;
    }
    clearGameSave(session.story.id);
    const engine = new RuntimeEngine(session.story, {
      plugins: [createDebugLoggerPlugin(import.meta.env.DEV)]
    });
    setSession({ ...session, engine });
    setSnapshot(engine.snapshot());
    setMessage("新游戏开始");
  }

  function handleStoryChange(storyId: string) {
    const entry = catalog?.stories.find((storyEntry) => storyEntry.id === storyId);
    if (entry) {
      void startStory(entry);
    }
  }

  function handleMuteToggle() {
    if (!session) {
      return;
    }
    const nextMuted = !muted;
    setMuted(nextMuted);
    session.audio.setMuted(nextMuted);
  }

  return (
    <Shell>
      <main
        className={`stage transition-${snapshot.scene.transition ?? "fade"}`}
        style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined }}
      >
        <TopBar
          title={snapshot.storyTitle}
          nodeTitle={snapshot.nodeTitle}
          stories={catalog?.stories ?? [session.catalogEntry]}
          selectedStoryId={selectedStoryId}
          muted={muted}
          message={message}
          onStoryChange={handleStoryChange}
          onSave={handleSave}
          onLoad={handleLoad}
          onNewGame={handleNewGame}
          onMuteToggle={handleMuteToggle}
        />

        <div className="character-layer" aria-hidden="true">
          {snapshot.scene.characters.map((character) => (
            <CharacterSprite
              key={`${character.slot}:${character.character}`}
              character={character}
              story={story}
              assets={assets}
            />
          ))}
        </div>

        <section className="dialogue-panel" aria-live="polite">
          {snapshot.ending ? (
            <EndingPanel onNewGame={handleNewGame} />
          ) : line ? (
            <>
              <div className="speaker-row">
                <span className="speaker-name" style={{ color: speaker?.color }}>{speakerName}</span>
                {line.voice && <span className="voice-chip">VOICE</span>}
              </div>
              <p className="dialogue-text">{line.text}</p>
              <button className="primary-button" onClick={handleContinue}>继续 ⏎</button>
            </>
          ) : (
            <ChoicePanel snapshot={snapshot} onChoice={handleChoice} />
          )}
        </section>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell">{children}</div>;
}

function TopBar(props: {
  title: string;
  nodeTitle?: string;
  stories: StoryCatalogEntry[];
  selectedStoryId: string;
  muted: boolean;
  message: string;
  onStoryChange: (storyId: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  onMuteToggle: () => void;
}) {
  return (
    <header className="top-bar">
      <div>
        <div className="game-title">{props.title}</div>
        <div className="node-title">{props.nodeTitle ?? "未命名段落"}</div>
      </div>
      <div className="toolbar">
        <select
          aria-label="选择故事"
          value={props.selectedStoryId}
          onChange={(event) => props.onStoryChange(event.currentTarget.value)}
        >
          {props.stories.map((story) => (
            <option key={story.id} value={story.id}>{story.title}</option>
          ))}
        </select>
        {props.message && <span className="toast">{props.message}</span>}
        <button onClick={props.onSave}>保存</button>
        <button onClick={props.onLoad}>读取</button>
        <button onClick={props.onNewGame}>新游戏</button>
        <button onClick={props.onMuteToggle}>{props.muted ? "开声音" : "静音"}</button>
      </div>
    </header>
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
    />
  );
}

function ChoicePanel(props: { snapshot: RuntimeSnapshot; onChoice: (choiceId: string) => void }) {
  if (props.snapshot.availableChoices.length === 0) {
    return <p className="dialogue-text">没有可用选项。请检查剧情节点是否缺少 next / choices。</p>;
  }

  return (
    <div className="choice-list">
      {props.snapshot.availableChoices.map((choice) => (
        <button className="choice-button" key={choice.id} onClick={() => props.onChoice(choice.id)}>
          <span>{choice.text}</span>
          {choice.hint && <small>{choice.hint}</small>}
        </button>
      ))}
    </div>
  );
}

function EndingPanel({ onNewGame }: { onNewGame: () => void }) {
  return (
    <div>
      <div className="ending-title">故事结束</div>
      <p className="dialogue-text">你已经抵达当前故事的终点。添加更多节点即可继续扩展。</p>
      <button className="primary-button" onClick={onNewGame}>重新开始</button>
    </div>
  );
}

function findCharacter(story: Story, id: string): Character | undefined {
  return story.characters.find((character) => character.id === id);
}

function resolveImage(assets: AssetManifest, id: string | null | undefined) {
  if (!id) {
    return undefined;
  }
  return assets.images[id];
}
