import { useState, useEffect, useRef } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+-=?";

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function DiffusingText({ text, phase, delay = 0, onComplete, speed = 50 }) {
  const length = text.length;
  const [display, setDisplay] = useState("");
  const [opacity, setOpacity] = useState(0);
  const tickRef = useRef(0);
  const intervalRef = useRef(null);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    tickRef.current = 0;
    clearInterval(intervalRef.current);

    if (phase === "idle") {
      setDisplay("");
      setOpacity(0);
      return;
    }

    const totalSteps = 18;
    const isRevealing = phase === "revealing";

    const startDelay = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        tickRef.current += 1;
        const tick = tickRef.current;
        const progress = tick / totalSteps;

        if (isRevealing) {
          const resolved = Math.floor(progress * length);
          let str = "";
          for (let i = 0; i < length; i++) {
            if (text[i] === " ") {
              str += " ";
            } else if (i < resolved) {
              str += text[i];
            } else {
              str += randomChar();
            }
          }
          setDisplay(str);
          setOpacity(Math.min(1, progress * 1.5));
        } else {
          const scrambled = Math.floor(progress * length);
          let str = "";
          for (let i = 0; i < length; i++) {
            if (text[i] === " ") {
              str += " ";
            } else if (i < scrambled) {
              str += randomChar();
            } else {
              str += text[i];
            }
          }
          setDisplay(str);
          setOpacity(Math.max(0, 1 - progress * 1.2));
        }

        if (tick >= totalSteps) {
          clearInterval(intervalRef.current);
          if (isRevealing) {
            setDisplay(text);
            setOpacity(1);
          } else {
            setDisplay("");
            setOpacity(0);
          }
          if (!completedRef.current) {
            completedRef.current = true;
            if (onComplete) onComplete();
          }
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startDelay);
      clearInterval(intervalRef.current);
    };
  }, [text, phase, delay]);

  return (
    <span style={{ opacity, transition: "opacity 0.1s ease" }}>
      {display || text}
    </span>
  );
}

export default function TextDiffusion({ items, displayCount = 8, eventName, startHidden = false, introText = "", gridClassName = "grid grid-cols-2 gap-x-6 gap-y-1" }) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [pendingGroup, setPendingGroup] = useState(null);
  const [phase, setPhase] = useState(startHidden ? "idle" : "revealing");
  const [visible, setVisible] = useState(!startHidden);
  const groupCount = Math.ceil(items.length / displayCount);
  const [revealedCount, setRevealedCount] = useState(0);
  const [fadedCount, setFadedCount] = useState(0);

  const currentItems = items.slice(
    groupIndex * displayCount,
    groupIndex * displayCount + displayCount
  );

  while (currentItems.length < displayCount) {
    currentItems.push(items[currentItems.length % items.length]);
  }

  // Listen for external toggle event — interrupt any in-progress animation
  useEffect(() => {
    if (!eventName) return;
    const handler = (e) => {
      const target = e.detail?.group;
      if (typeof target !== "number") return;
      if (startHidden) {
        if (target === 1) {
          setVisible(true);
          setRevealedCount(0);
          setFadedCount(0);
          setPhase("revealing");
        } else {
          setRevealedCount(0);
          setFadedCount(0);
          setPhase("fading");
        }
        return;
      }
      if (target === groupIndex && pendingGroup === null && phase === "revealing") return;
      // Immediately jump: skip fade, go straight to new group
      setPendingGroup(null);
      setGroupIndex(target);
      setRevealedCount(0);
      setFadedCount(0);
      setPhase("revealing");
    };
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [eventName, groupIndex, pendingGroup, phase, startHidden]);

  useEffect(() => {
    setRevealedCount(0);
    setFadedCount(0);
  }, [groupIndex]);

  // After all faded, switch group or hide
  useEffect(() => {
    if (fadedCount === displayCount && phase === "fading") {
      const timeout = setTimeout(() => {
        if (startHidden) {
          setVisible(false);
          setPhase("idle");
          return;
        }
        if (pendingGroup !== null) {
          setGroupIndex(pendingGroup);
          setPendingGroup(null);
        }
        setPhase("revealing");
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [fadedCount, displayCount, phase, pendingGroup, startHidden]);

  if (!visible) return null;

  const introDelay = introText ? 300 : 0;
  return (
      <div className="mt-2">
        {introText && (
          <p className="text-gray-600 text-sm leading-relaxed mb-2">
            <DiffusingText
              text={introText}
              phase={phase === "revealing" ? "revealing" : phase === "fading" ? "fading" : "idle"}
              delay={0}
              speed={15}
              onComplete={() => {}}
            />
          </p>
        )}
        <div className={gridClassName}>
          {currentItems.map((item, i) => (
            <div key={`${groupIndex}-${i}`} className="flex items-center gap-2 text-gray-600 text-sm">
              <span
                className="text-illinois-orange"
                style={{
                  opacity: phase === "fading" ? 0 : phase === "revealing" ? 1 : 0,
                  transition: "opacity 0.4s ease",
                }}
              >•</span>
              <DiffusingText
                text={item}
                phase={phase === "revealing" ? "revealing" : phase === "fading" ? "fading" : "idle"}
                delay={introDelay + i * 100}
                onComplete={() => {
                  if (phase === "revealing") setRevealedCount((c) => c + 1);
                  else if (phase === "fading") setFadedCount((c) => c + 1);
                }}
              />
            </div>
          ))}
        </div>
      </div>
  );
}
