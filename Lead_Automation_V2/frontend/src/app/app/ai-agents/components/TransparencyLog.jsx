import React, { useRef, useEffect } from 'react';

const TransparencyLog = ({ logs }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div ref={scrollRef} className="h-[300px] md:h-full p-4 space-y-3 font-mono text-sm">
      {logs.length === 0 ? (
        <div className="text-muted-foreground text-center mt-10">No recent activity</div>
      ) : (
        logs.map((log, index) => (
          <div key={index} className="flex flex-col">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-1">
              <span>{log.timestamp}</span>
              <span>•</span>
              <span className="font-semibold text-primary">{log.agent}</span>
            </div>
            <div className="bg-secondary/20 p-2 rounded-md border border-secondary/50 text-foreground/90">
              {log.message}
            </div>
            {log.action && (
              <div className="ml-4 mt-1 flex items-center space-x-2 text-xs">
                <span className="text-blue-400">↳ Action taken:</span>
                <span className="font-medium">{log.action}</span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default TransparencyLog;
