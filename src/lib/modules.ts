import {

  Camera,
  Car,
  GraduationCap,
  HeartPulse,
  House,
  Lightbulb,
  LockKeyhole,
  Plane,
  ShieldCheck,
  Sunrise,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface PlannedModule {
  name: string;
  icon: LucideIcon;
  note?: string;
}

/** Roadmap modules not built yet. Shown honestly as "Planned". */
export const PLANNED_MODULES: PlannedModule[] = [
  { name: "Financial Overview", icon: Wallet },
  { name: "Calendar & Travel", icon: Plane },
  { name: "LifeLock", icon: ShieldCheck, note: "Needs a legitimate integration" },
  { name: "Home Security / Vivint", icon: House, note: "Needs a legitimate integration" },
  { name: "Photo & Travel Journal", icon: Camera },
  { name: "Learning Center", icon: GraduationCap },
  { name: "Health & Wellness", icon: HeartPulse },
  { name: "Goals & Milestones", icon: Target },
  { name: "Ideas & Projects", icon: Lightbulb },
  { name: "Home & Vehicle", icon: Car },
  { name: "Digital Vault & Emergency Planning", icon: LockKeyhole },
  { name: "AI Daily Briefing", icon: Sunrise },
];

export const CAPTURE_PLANNED_NOTE = "Voice, photos, files, and AI sorting are planned for Capture.";
