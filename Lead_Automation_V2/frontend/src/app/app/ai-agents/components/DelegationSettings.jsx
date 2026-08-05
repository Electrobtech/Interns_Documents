import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ShieldAlert } from 'lucide-react';

const DelegationSettings = ({ agentId }) => {
  const [autonomyLevel, setAutonomyLevel] = useState([50]);
  
  const getAutonomyText = (val) => {
    if (val < 30) return "Manual Review (Co-pilot)";
    if (val < 75) return "Supervised Automation";
    return "Fully Autonomous";
  };

  return (
    <Card className="border-primary/20 bg-background/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <span>Progressive Delegation</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="font-semibold text-sm">Autonomy Level</Label>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
              {getAutonomyText(autonomyLevel[0])}
            </span>
          </div>
          <Slider 
            defaultValue={[50]} 
            max={100} 
            step={1} 
            value={autonomyLevel}
            onValueChange={setAutonomyLevel}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Adjust how much freedom this agent has. At lower levels, it drafts actions for your approval. At higher levels, it executes them automatically.
          </p>
        </div>

        <div className="space-y-4 pt-4 border-t border-border/50">
          <h4 className="text-sm font-semibold mb-3">Granular Permissions</h4>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Auto-reply to leads</Label>
              <p className="text-[10px] text-muted-foreground">Directly message via WhatsApp</p>
            </div>
            <Switch defaultChecked={autonomyLevel[0] > 70} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Schedule Calendar Posts</Label>
              <p className="text-[10px] text-muted-foreground">Post to social media without review</p>
            </div>
            <Switch defaultChecked={autonomyLevel[0] > 40} />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Generate Media Content</Label>
              <p className="text-[10px] text-muted-foreground">Create images/video from text</p>
            </div>
            <Switch defaultChecked={true} />
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default DelegationSettings;
