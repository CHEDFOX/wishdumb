import React from "react";
import { Thought } from "../types";

interface Props {
  thought: Thought;
}

const FloatingThought: React.FC<Props> = ({ thought }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: thought.x,
        top: thought.y,
        transform: `translate(-50%, -50%) scale(${thought.scale})`,
        opacity: thought.opacity,
        pointerEvents: "none",
        maxWidth: thought.kind === "question" ? "420px" : "560px",
        zIndex: thought.kind === "response" ? 100 : 10,
      }}
      className="select-none"
    >
      <p
        className={`
          text-center italic tracking-wide leading-relaxed
          ${
            thought.kind === "question"
              ? "text-xs text-white/40"
              : "text-sm md:text-base text-white/80"
          }
        `}
      >
        {thought.text}
      </p>
    </div>
  );
};

export default FloatingThought;
