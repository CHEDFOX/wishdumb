import React from "react";
import { Thought } from "../types";

interface FloatingThoughtProps {
  thought: Thought;
  isLatest: boolean;
}

const FloatingThought: React.FC<FloatingThoughtProps> = ({ thought }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: thought.x,
        top: thought.y,
        transform: `translate(-50%, -50%) scale(${thought.scale})`,
        opacity: thought.opacity,
        pointerEvents: "none",
        maxWidth: "560px",
        zIndex: Math.floor(thought.opacity * 100),
      }}
      className="select-none"
    >
      <p
        className="
          text-center
          italic
          tracking-wide
          leading-relaxed
          text-sm
          md:text-base
          text-white/80
        "
      >
        {thought.text}
      </p>
    </div>
  );
};

export default FloatingThought;
