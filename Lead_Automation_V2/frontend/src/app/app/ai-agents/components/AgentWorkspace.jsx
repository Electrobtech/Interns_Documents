import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, PauseCircle, PlayCircle, Clock } from 'lucide-react';
import TransparencyLog from './TransparencyLog';
import ConfidenceIndicator from './ConfidenceIndicator';
import DelegationSettings from './DelegationSettings';

const AgentWorkspace = ({ agent, isPaused, togglePause }) => {
  return (
    <div className="flex flex-col h-full space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
            <p className="text-muted-foreground">{agent.role} Agent</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge variant={isPaused ? "destructive" : "default"} className="px-3 py-1">
            {isPaused ? 'Paused / Manual Override' : 'Active / Monitoring'}
          </Badge>
          <Button 
            variant={isPaused ? "default" : "destructive"} 
            onClick={togglePause}
            className="flex items-center space-x-2"
          >
            {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            <span>{isPaused ? 'Resume Agent' : 'Pause Agent (Override)'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        
        {/* Left Column: Task Queue & Delegation */}
        <div className="space-y-6 md:col-span-1">
          <Card className="flex-1 border-primary/20 bg-background/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Clock className="w-5 h-5 text-primary" />
                <span>Task Queue</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agent.tasks.map(task => (
                  <div key={task.id} className="p-3 rounded-md bg-secondary/30 border border-secondary">
                    <p className="text-sm font-medium">{task.description}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-muted-foreground">{task.time}</span>
                      <Badge variant="outline" className="text-[10px]">{task.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <DelegationSettings agentId={agent.id} />
        </div>

        {/* Right Column: Transparency Log & Confidence Indicator */}
        <div className="space-y-6 md:col-span-2 flex flex-col">
          <Card className="flex-none border-primary/20 bg-background/50 backdrop-blur">
            <CardContent className="p-6">
               <ConfidenceIndicator score={agent.currentConfidence} />
            </CardContent>
          </Card>

          <Card className="flex-1 flex flex-col border-primary/20 bg-background/50 backdrop-blur overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-secondary/10">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>Agent Brain Log (Transparency)</span>
                <Badge variant="secondary" className="font-normal text-xs">Real-time Analysis</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-y-auto">
              <TransparencyLog logs={agent.logs} />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default AgentWorkspace;
