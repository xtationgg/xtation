"use client";

import React from "react";
import { LabCanvas } from "../LabCanvas";

/**
 * SANDBOX: Full Lab canvas with glow wire effects.
 * This renders the real LabCanvas inside a wrapper that applies
 * glow-enhanced CSS overrides to edges/wires only.
 * Delete this entire /sandbox/ folder to remove it cleanly.
 */
export const GlowDemo: React.FC = () => {
  return (
    <div className="xt-glow-sandbox" style={{ height: '100%', width: '100%' }}>
      <LabCanvas />
    </div>
  );
};
