import { create } from "zustand";

interface UIState {
  authDialogOpen: boolean;
  setAuthDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  authDialogOpen: false,
  setAuthDialogOpen: (open) => set({ authDialogOpen: open }),
}));
