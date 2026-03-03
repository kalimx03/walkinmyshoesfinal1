
import React, { useState, useEffect, useRef } from 'react';
import { geminiService } from '../services/gemini';
import { ChatMessage } from '../types';

interface Props {
  context: string;
  history: ChatMessage[];
  onUpdateHistory: (messages: ChatMessage[]) => void;
  embedded?: boolean;
}

const AIGuide: React.FC<Props> = ({ context, history, onUpdateHistory, embedded = false }) => {
  const [isExpanded, setIsExpanded] = useState(!embedded);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    `Explain the detected issues`,
    "What are WCAG contrast rules?",
    "How can I fix these barriers?",
    "Why is this so difficult?"
  ];

  useEffect(() => {
    const sdkHistory = history.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    chatRef.current = geminiService.createGuideChat(context, sdkHistory);
    
    if (history.length === 0) {
      const welcomeMsg: ChatMessage = { 
        role: 'model', 
        text: `Hello! I'm your interactive AI guide for this ${context} session. I'm here to answer questions about the environment, explain accessibility standards like ADA or WCAG, and provide remediation advice. How can I help you today?`,
        timestamp: Date.now()
      };
      onUpdateHistory([welcomeMsg]);
    }
  }, [context]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [history, isExpanded, isLoading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text, timestamp: Date.now() };
    const updatedHistory = [...history, userMsg];
    onUpdateHistory(updatedHistory);
    
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: text });
      const modelMsg: ChatMessage = { 
        role: 'model', 
        text: response.text || "I'm sorry, I couldn't process that right now.",
        timestamp: Date.now()
      };
      onUpdateHistory([...updatedHistory, modelMsg]);
    } catch (error) {
      console.error("AI Guide Error:", error);
      const errorMsg: ChatMessage = { 
        role: 'model', 
        text: "I encountered a connectivity issue. Please try your question again.",
        timestamp: Date.now()
      };
      onUpdateHistory([...updatedHistory, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
    setInputValue('');
  };

  const visibleMessages = history.filter(m => !m.isHidden);

  const MainContent = (
    <div className={`flex flex-col h-full ${embedded ? 'bg-transparent' : 'bg-slate-900/90 backdrop-blur-2xl border-l border-slate-800 pointer-events-auto overflow-hidden shadow-2xl transition-all duration-500 transform'} ${
      !embedded && (isExpanded ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0')
    }`}>
      <div className={`p-5 border-b border-slate-800 bg-gradient-to-r from-indigo-900/20 to-cyan-900/20 flex items-center justify-between ${embedded ? 'hidden' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-600/30">🤖</div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">AI Expert Guide</h4>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Insight</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowFullTranscript(true)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title="View Full Reference History"
        >
          📜
        </button>
      </div>

      {/* Chat History Section */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth custom-scrollbar"
      >
        {visibleMessages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
              msg.role === 'user' 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
            <span className="text-[9px] text-slate-600 mt-1.5 uppercase font-bold tracking-tighter px-1 opacity-60">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none border border-slate-700/50 flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
      </div>

      {/* Action Tray: Suggested Questions */}
      <div className="px-5 py-2 overflow-x-auto whitespace-nowrap no-scrollbar flex gap-2 border-t border-slate-800/50 bg-slate-950/20">
        {suggestedQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(q)}
            disabled={isLoading}
            className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full hover:bg-indigo-500/20 transition-all whitespace-nowrap active:scale-95 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-5 bg-slate-950/80 border-t border-slate-800">
        <form onSubmit={onSubmitForm} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask your guide..."
              className="flex-1 bg-slate-800/50 border border-slate-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-500 text-white"
            />
            <button 
              type="submit" 
              disabled={isLoading || !inputValue.trim()}
              className="bg-indigo-600 text-white w-12 rounded-2xl font-bold text-lg hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center active:scale-90"
            >
              <span>↑</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="h-full flex flex-col">{MainContent}</div>;
  }

  return (
    <>
      <div 
        className={`fixed top-16 right-0 bottom-0 z-[60] flex transition-all duration-500 ease-in-out pointer-events-none ${
          isExpanded ? 'w-80 md:w-96' : 'w-12'
        }`}
      >
        {/* Collapse/Expand Tab */}
        <div className="flex flex-col justify-center h-full">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="pointer-events-auto bg-slate-900 border border-slate-800 border-r-0 rounded-l-2xl p-2 h-24 shadow-2xl text-slate-400 hover:text-white transition-all hover:bg-slate-800 flex items-center justify-center group"
            aria-label={isExpanded ? "Collapse Guide" : "Expand Guide"}
          >
            <div className={`transition-transform duration-500 font-bold ${isExpanded ? 'rotate-0' : 'rotate-180'}`}>
              {isExpanded ? '▶' : '◀'}
            </div>
          </button>
        </div>

        {/* Main Panel Content */}
        {MainContent}

        {/* Floating Fab when collapsed */}
        {!isExpanded && (
          <button 
            onClick={() => setIsExpanded(true)}
            className="absolute top-1/2 -translate-y-1/2 right-4 pointer-events-auto w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-2xl transition-all active:scale-90"
            title="Open AI Guide"
          >
            <span className="text-xl">🤖</span>
          </button>
        )}
      </div>

      {/* Full Transcript Overlay for User Reference */}
      {showFullTranscript && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-3xl h-[85vh] rounded-3xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 bg-indigo-600/10 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Consultation Reference Log</h2>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">
                  Session: {context}
                </p>
              </div>
              <button 
                onClick={() => setShowFullTranscript(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-950/30 custom-scrollbar">
              {visibleMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                      {msg.role === 'user' ? 'Inquirer' : 'AI Specialist'}
                    </span>
                    <span className="text-[10px] text-slate-700 font-bold">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className={`p-6 rounded-3xl max-w-[90%] text-sm leading-relaxed border shadow-lg ${
                    msg.role === 'user' 
                    ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-100 rounded-tr-none' 
                    : 'bg-slate-800/50 border-slate-700 text-slate-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-center gap-4 bg-slate-900">
              <button 
                onClick={() => {
                  const transcript = visibleMessages.map(m => `[${m.role.toUpperCase()}] ${m.text}`).join('\n\n');
                  navigator.clipboard.writeText(transcript);
                  alert('Transcript copied to clipboard!');
                }}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <span>📋</span> Copy Reference Log
              </button>
              <button 
                onClick={() => setShowFullTranscript(false)}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all"
              >
                Return to View
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.5); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </>
  );
};

export default AIGuide;
