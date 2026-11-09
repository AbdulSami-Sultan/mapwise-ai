/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import {
  Send,
  Compass,
  Utensils,
  Navigation,
  Sparkles,
  MapPin,
  ExternalLink,
  Search,
  Globe,
  Trash2,
  RefreshCw,
  ChevronDown,
  Layers,
  Map as MapIcon,
  HelpCircle,
  Copy,
  Check,
  Star,
  Quote,
  Bookmark,
} from 'lucide-react';
import { Message, PlaceMarker, RolePersonaId, GroundingMode, MapCoordinates } from '../types.ts';
import { PERSONAS } from '../constants/personas.ts';

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  activePersonaId: RolePersonaId;
  groundingMode: GroundingMode;
  activeModel: string;
  currentMapCenter: MapCoordinates;
  currentMapZoom: number;
  cityName?: string;
  places: PlaceMarker[];
  onSendMessage: (text: string) => void;
  onSelectPersona: (id: RolePersonaId) => void;
  onSelectGroundingMode: (mode: GroundingMode) => void;
  onSelectModel: (model: string) => void;
  onClearChat: () => void;
  onSelectPlace: (place: PlaceMarker) => void;
  onRequestUserLocation: () => void;
  isPlaceSaved: (id: string) => boolean;
  onToggleSavePlace: (place: PlaceMarker) => void;
}

const PERSONA_ICONS = {
  guide: Compass,
  foodie: Utensils,
  transit: Navigation,
  curator: Sparkles,
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  activePersonaId,
  groundingMode,
  activeModel,
  currentMapCenter,
  cityName,
  places,
  onSendMessage,
  onSelectPersona,
  onSelectGroundingMode,
  onSelectModel,
  onClearChat,
  onSelectPlace,
  isPlaceSaved,
  onToggleSavePlace,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activePersona = PERSONAS.find((p) => p.id === activePersonaId) || PERSONAS[0];
  const ActiveIcon = PERSONA_ICONS[activePersona.id] || Compass;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Adjust textarea height automatically
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const renderMarkdown = (content: string) => {
    try {
      return { __html: marked.parse(content, { breaks: true, gfm: true }) as string };
    } catch {
      return { __html: content };
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border-r border-slate-800/80">
      {/* Top Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl ${activePersona.avatarColor} flex items-center justify-center shadow-md shadow-emerald-950/40 text-white font-bold`}>
            <ActiveIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm tracking-tight text-white">MapSphere AI</h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Grounding
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-[240px]">
              {activePersona.name}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          {/* Persona Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPersonaMenu(!showPersonaMenu)}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 border border-slate-700 transition"
              title="Change Chatbot Persona"
            >
              <span>Role</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showPersonaMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider">
                  Select Assistant Role
                </div>
                {PERSONAS.map((p) => {
                  const Icon = PERSONA_ICONS[p.id];
                  const isSelected = p.id === activePersonaId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectPersona(p.id);
                        setShowPersonaMenu(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition ${
                        isSelected
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${p.avatarColor} text-white flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{p.tagline}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grounding & Model Settings */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowConfigMenu(!showConfigMenu)}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                groundingMode === 'maps'
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                  : groundingMode === 'search'
                  ? 'border-sky-500/40 bg-sky-950/40 text-sky-300'
                  : 'border-slate-700 bg-slate-800 text-slate-200'
              }`}
              title="Grounding & Model Options"
            >
              {groundingMode === 'maps' ? (
                <MapIcon className="w-4 h-4 text-emerald-400" />
              ) : groundingMode === 'search' ? (
                <Search className="w-4 h-4 text-sky-400" />
              ) : (
                <Globe className="w-4 h-4 text-slate-300" />
              )}
              <span className="hidden sm:inline capitalize text-[11px] font-medium">
                {groundingMode}
              </span>
            </button>

            {showConfigMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-50">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-1 mb-1 tracking-wider">
                  Grounding Mode
                </div>
                <div className="grid grid-cols-3 gap-1 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectGroundingMode('maps');
                      setShowConfigMenu(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
                      groundingMode === 'maps'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Maps
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectGroundingMode('search');
                      setShowConfigMenu(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
                      groundingMode === 'search'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectGroundingMode('auto');
                      setShowConfigMenu(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
                      groundingMode === 'auto'
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Auto
                  </button>
                </div>

                <div className="text-[10px] uppercase font-bold text-slate-400 px-1 mb-1 tracking-wider">
                  Gemini Model
                </div>
                <div className="space-y-1">
                  {[
                    { id: 'gemini-3.8-flash', label: 'gemini-3.8-flash (Recommended)' },
                    { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Fast)' },
                    { id: 'gemini-4-argon', label: 'gemini-4-argon (Deep reasoning)' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(m.id);
                        setShowConfigMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                        activeModel === m.id
                          ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clear conversation */}
          <button
            type="button"
            onClick={onClearChat}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map Sync Context Banner */}
      <div className="px-3 py-1.5 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">
            Target View: <span className="text-slate-200 font-mono">{currentMapCenter.lat.toFixed(3)}, {currentMapCenter.lng.toFixed(3)}</span>
            {cityName ? ` (${cityName})` : ''}
          </span>
        </div>
        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 shrink-0">
          Real-time
        </span>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className={`w-12 h-12 rounded-2xl ${activePersona.avatarColor} flex items-center justify-center text-white mb-3 shadow-xl`}>
              <ActiveIcon className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-base text-white">{activePersona.name}</h2>
            <p className="text-xs text-slate-400 max-w-xs mt-1 mb-5">
              {activePersona.systemSummary}
            </p>

            {/* Prompt starters */}
            <div className="w-full max-w-sm space-y-2 text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Try asking:
              </span>
              {activePersona.suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSendMessage(prompt)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800/80 text-xs text-slate-200 hover:text-white transition flex items-center gap-2 group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition" />
                  <span className="line-clamp-2">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.role === 'user';
            const isCopied = copiedMessageId === message.id;

            return (
              <div
                key={message.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 shadow-sm text-xs md:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-sky-600 text-white rounded-br-xs'
                      : 'bg-slate-900 border border-slate-800/90 text-slate-200 rounded-bl-xs'
                  }`}
                >
                  {!isUser ? (
                    <div>
                      {/* Markdown text */}
                      <div
                        className="prose prose-invert prose-xs sm:prose-sm max-w-none [&_p]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:mb-1 [&_strong]:text-white [&_a]:text-sky-400 [&_a]:underline"
                        dangerouslySetInnerHTML={renderMarkdown(message.text)}
                      />

                      {/* Discovered places interactive cards */}
                      {message.places && message.places.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            <span>Locations Mentioned ({message.places.length}):</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5">
                            {message.places.map((place) => {
                              const isSaved = isPlaceSaved(place.id);
                              return (
                                <div
                                  key={place.id}
                                  onClick={() => onSelectPlace(place)}
                                  className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 transition flex items-start justify-between gap-2 group/card cursor-pointer"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-xs text-white group-hover/card:text-sky-300">
                                        {place.name}
                                      </span>
                                      <span className="text-[9px] uppercase px-1 rounded bg-slate-800 text-slate-400">
                                        {place.category}
                                      </span>
                                      {isSaved && (
                                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-0.5">
                                          <Bookmark className="w-2 h-2 fill-amber-400 text-amber-400" />
                                          Saved
                                        </span>
                                      )}
                                    </div>
                                    {place.description && (
                                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                        {place.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {place.rating && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-semibold bg-amber-950/40 px-1 py-0.5 rounded border border-amber-800/40">
                                        <Star className="w-2.5 h-2.5 fill-amber-400" />
                                        {place.rating.toFixed(1)}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleSavePlace(place);
                                      }}
                                      className={`p-1 rounded-lg transition ${
                                        isSaved
                                          ? 'text-amber-400 bg-amber-950/50 hover:bg-amber-950/80 border border-amber-800/50'
                                          : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                                      }`}
                                      title={isSaved ? 'Remove from saved' : 'Save place'}
                                      aria-label={isSaved ? 'Remove from saved' : 'Save place'}
                                    >
                                      <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-400' : ''}`} />
                                    </button>
                                    <MapPin className="w-3.5 h-3.5 text-sky-400 group-hover/card:translate-x-0.5 transition" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Real-time Grounding Sources */}
                      {message.groundingSources && message.groundingSources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                            {message.groundingModeUsed === 'maps' ? (
                              <MapIcon className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Globe className="w-3 h-3 text-sky-400" />
                            )}
                            <span>Grounding Sources & Verification:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {message.groundingSources.map((src, idx) => (
                              <a
                                key={idx}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-[11px] text-sky-300 hover:text-white transition max-w-[220px] truncate"
                                title={src.snippet || src.title}
                              >
                                {src.sourceType === 'maps' ? (
                                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                                ) : (
                                  <ExternalLink className="w-3 h-3 text-sky-400 shrink-0" />
                                )}
                                <span className="truncate">{src.title || 'Location Source'}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Web Search queries if search grounding was active */}
                      {message.webSearchQueries && message.webSearchQueries.length > 0 && (
                        <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400">Search queries:</span>
                          {message.webSearchQueries.map((q, i) => (
                            <span key={i} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                              "{q}"
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>{message.text}</div>
                  )}
                </div>

                {/* Message Footer / Copy */}
                <div className="flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition text-[10px] text-slate-400">
                  <span>{message.timestamp}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(message.id, message.text)}
                    className="hover:text-slate-200 p-0.5 rounded"
                    title="Copy response"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className={`w-7 h-7 rounded-lg ${activePersona.avatarColor} text-white flex items-center justify-center shrink-0 animate-pulse`}>
              <ActiveIcon className="w-4 h-4" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-xs p-3.5 flex items-center gap-2 text-xs text-slate-300 shadow-sm">
              <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              <span>
                {groundingMode === 'maps'
                  ? 'Querying real-time Google Maps & Places...'
                  : groundingMode === 'search'
                  ? 'Searching real-time Google web data...'
                  : 'Analyzing location coordinates with Gemini 3.8 Flash...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Discovered places shortcut pill drawer */}
      {places.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-800/80 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
            Pins:
          </span>
          {places.slice(0, 5).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPlace(p)}
              className="px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white shrink-0 border border-slate-700/60 flex items-center gap-1 transition"
            >
              <MapPin className="w-2.5 h-2.5 text-emerald-400" />
              <span className="max-w-[100px] truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleFormSubmit} className="p-3 border-t border-slate-800 bg-slate-900/90">
        <div className="relative flex items-end bg-slate-950 border border-slate-800 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-sky-500/60 focus-within:border-sky-500 transition shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${activePersona.name} about this area...`}
            className="w-full bg-transparent text-xs md:text-sm text-slate-100 placeholder-slate-400 px-2.5 py-1.5 resize-none outline-none max-h-32"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-medium transition shadow-md shrink-0 mb-0.5 mr-0.5"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
          <span>Shift+Enter for new line</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active: {activeModel}
          </span>
        </div>
      </form>
    </div>
  );
};
