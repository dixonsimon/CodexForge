"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  conversations: any[];
  setConversations: (convs: any[]) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  handleSelectConversation: (id: string) => Promise<void>;
  handleNewSession: () => void;
  handleDeleteConversation: (id: string, e: React.MouseEvent) => Promise<void>;
  handleRenameConversation: (id: string, newTitle: string) => Promise<void>;
  isSyncing: boolean;
  syncStatus: string;
  handleSyncIndex: () => Promise<void>;
  registerCallbacks: (callbacks: {
    handleSelectConversation: (id: string) => Promise<void>;
    handleNewSession: () => void;
    handleDeleteConversation: (id: string, e: React.MouseEvent) => Promise<void>;
    handleRenameConversation: (id: string, newTitle: string) => Promise<void>;
    handleSyncIndex: () => Promise<void>;
  }) => void;
  setSyncState: (syncing: boolean, status: string) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversationsState] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [isSyncing, setIsSyncingState] = useState(false);
  const [syncStatus, setSyncStatusState] = useState("Not Synced");

  const [callbacks, setCallbacks] = useState<{
    handleSelectConversation: (id: string) => Promise<void>;
    handleNewSession: () => void;
    handleDeleteConversation: (id: string, e: React.MouseEvent) => Promise<void>;
    handleRenameConversation: (id: string, newTitle: string) => Promise<void>;
    handleSyncIndex: () => Promise<void>;
  }>({
    handleSelectConversation: async () => {},
    handleNewSession: () => {},
    handleDeleteConversation: async () => {},
    handleRenameConversation: async () => {},
    handleSyncIndex: async () => {},
  });

  const registerCallbacks = (newCallbacks: typeof callbacks) => {
    setCallbacks(newCallbacks);
  };

  const setSyncState = (syncing: boolean, status: string) => {
    setIsSyncingState(syncing);
    setSyncStatusState(status);
  };

  return (
    <SidebarContext.Provider
      value={{
        conversations,
        setConversations: setConversationsState,
        activeConversationId,
        setActiveConversationId: setActiveConversationIdState,
        handleSelectConversation: callbacks.handleSelectConversation,
        handleNewSession: callbacks.handleNewSession,
        handleDeleteConversation: callbacks.handleDeleteConversation,
        handleRenameConversation: callbacks.handleRenameConversation,
        isSyncing,
        syncStatus,
        handleSyncIndex: callbacks.handleSyncIndex,
        registerCallbacks,
        setSyncState,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
