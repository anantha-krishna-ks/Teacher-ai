import React from "react";

export default function LiveInteractButton({ isLiveMode, isListening, isProcessing, liveTranscript, onToggle, disabled }) {
  if (!isLiveMode) {
    return (
      <button
        type="button"
        className="live-interact-btn"
        onClick={onToggle}
        disabled={disabled}
        title={disabled ? "Upload a book to use Live Interact" : "Start voice conversation with the AI Teacher"}
      >
        <span style={{ fontSize: '16px' }}>🎙</span>
        <span>LIVE</span>
      </button>
    );
  }

  return (
    <div className="live-active-panel">
      <div className="live-status-row">
        {isProcessing ? (
          <div className="live-status thinking">
            <span className="live-status-dot thinking-dot" />
            <span>Thinking…</span>
          </div>
        ) : isListening ? (
          <div className="live-status listening">
            <span className="live-status-dot pulse-dot" />
            <span>Listening…</span>
          </div>
        ) : (
          <div className="live-status idle">
            <span className="live-status-dot idle-dot" />
            <span>Speaking…</span>
          </div>
        )}
        <button type="button" className="live-stop-btn" onClick={onToggle} title="Stop Live Interact">
          ⏹ Stop
        </button>
      </div>
      {liveTranscript && (
        <div className="live-transcript-preview">
          <span style={{ fontStyle: 'normal', flexShrink: 0 }}>💬</span>
          <span style={{ flex: 1, wordBreak: 'break-word' }}>{liveTranscript}</span>
        </div>
      )}
    </div>
  );
}
