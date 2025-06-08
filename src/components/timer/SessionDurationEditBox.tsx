import React, { useState, useEffect } from 'react';

interface SessionDurationEditBoxProps {
  initialDuration: number;
  onChange: (seconds: number) => void;
}

export const SessionDurationEditBox: React.FC<SessionDurationEditBoxProps> = ({
  initialDuration,
  onChange,
}) => {
  const [hours, setHours] = useState(Math.floor(initialDuration / 3600));
  const [minutes, setMinutes] = useState(Math.floor((initialDuration % 3600) / 60));
  const [seconds, setSeconds] = useState(initialDuration % 60);

  useEffect(() => {
    onChange(hours * 3600 + minutes * 60 + seconds);
  }, [onChange, hours, minutes, seconds]);

  const pad = (n: number) => n.toString().padStart(2, '0');

  const update = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    value: number,
    max: number
  ) => {
    const newVal = (value + max) % max;
    setter(newVal);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<number>>,
    max: number
  ) => {
    const val = Math.min(max - 1, Math.max(0, parseInt(e.target.value) || 0));
    setter(val);
  };

  const ArrowControls = ({
    value,
    setter,
    max,
  }: {
    value: number;
    setter: React.Dispatch<React.SetStateAction<number>>;
    max: number;
  }) => (
    <div className="flex flex-col items-center ml-1 text-xs select-none">
      <div onClick={() => update(setter, value + 1, max)} style={{ cursor: 'pointer' }}>
        ▲
      </div>
      <div onClick={() => update(setter, value - 1 + max, max)} style={{ cursor: 'pointer' }}>
        ▼
      </div>
    </div>
  );
  return (
    <div className="flex items-center gap-1 font-mono text-2xl">
      <div className="flex items-center">
        <input
          type="number"
          value={pad(hours)}
          onChange={e => handleInputChange(e, setHours, 100)}
          className="w-10 text-center"
        />
        <ArrowControls value={hours} setter={setHours} max={100} />
      </div>
      :
      <div className="flex items-center">
        <input
          type="number"
          value={pad(minutes)}
          onChange={e => handleInputChange(e, setMinutes, 60)}
          className="w-10 text-center"
        />
        <ArrowControls value={minutes} setter={setMinutes} max={60} />
      </div>
      :
      <div className="flex items-center">
        <input
          type="number"
          value={pad(seconds)}
          onChange={e => handleInputChange(e, setSeconds, 60)}
          className="w-10 text-center"
        />
        <ArrowControls value={seconds} setter={setSeconds} max={60} />
      </div>
    </div>
  );
};
