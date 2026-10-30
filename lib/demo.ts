export const STUDENT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#84cc16", "#f43f5e",
];

export const DEMO_NAMES = [
  "Aisha", "Omar", "Fatima", "Yusuf", "Maryam", "Ibrahim", "Zainab", "Hamza",
  "Noor", "Ali", "Sara", "Adam", "Layla", "Zayd", "Hana", "Isa",
  "Amna", "Khalid", "Riya", "Arjun", "Nihal", "Safa", "Rayan", "Huda",
];

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
