import React from 'react';
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

const ConfidenceIndicator = ({ score = 0 }) => {
  // Determine status and colors based on score
  let status = "Low Confidence - Review Required";
  let colorClass = "text-destructive";
  let bgClass = "bg-destructive/20";
  let indicatorClass = "bg-destructive";
  let Icon = AlertCircle;

  if (score >= 85) {
    status = "High Confidence - Safe to Automate";
    colorClass = "text-green-500";
    bgClass = "bg-green-500/20";
    indicatorClass = "bg-green-500";
    Icon = CheckCircle2;
  } else if (score >= 60) {
    status = "Medium Confidence - Monitor closely";
    colorClass = "text-yellow-500";
    bgClass = "bg-yellow-500/20";
    indicatorClass = "bg-yellow-500";
    Icon = AlertTriangle;
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">AI Confidence Score</h3>
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-2 ${bgClass} ${colorClass}`}>
          <Icon className="w-4 h-4" />
          <span>{status}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <Progress value={score} className="h-3 flex-1" indicatorClassName={indicatorClass} />
        <span className={`font-bold text-lg w-12 text-right ${colorClass}`}>{score}%</span>
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        Based on past historical data, success rates of similar actions, and entity extraction confidence.
      </p>
    </div>
  );
};

export default ConfidenceIndicator;
