import { useEffect } from "react";
import { throttle, isFunction, values, uniq } from "lodash";
import { EVENTLISTENERTYPES } from "./constant";

let hookCount = 0;

const globalEventNames = values(EVENTLISTENERTYPES);

const defaultInActivityTime = 1000 * 4; //检测为静默的时长

const throttleTime = 1000 * 2;

let activityMark = true;

let inActivityTimers = []; //定时器集合

let inActivityTimes = []; //静默时长集合

let isInitDetect = false;

let inActivityEventQueue = {}; //进入静默时的事件集合

let activityEventMap = new Map(); //由静默到活跃的事件集合

const setinActivityTimers = () => {
  inActivityTimers.forEach((timers) => clearTimeout(timers));
  inActivityTimers = [];
  const events = activityEventMap.values();
  for (let event of Array.from(events)) {
    if (isFunction(event)) {
      event();
    }
  }
  activityEventMap = new Map();
  inActivityTimes.forEach((time) => {
    const thisTimer = setTimeout(() => {
      activityMark = false;
      //执行静默事件队列
      if (inActivityEventQueue[time]) {
        inActivityEventQueue[time].forEach((ck) => {
          const activityEvent = ck();
          if (activityEvent) activityEventMap.set(ck, activityEvent);
        });
      }
    }, time);
    inActivityTimers.push(thisTimer);
  });
};

const detectActivity = throttle(() => {
  if (!isInitDetect) return;
  activityMark = true;
  setinActivityTimers();
}, throttleTime);

const registerEvents = () => {
  isInitDetect = true;
  globalEventNames.forEach((name) => {
    window.addEventListener(name, detectActivity);
  });
};

const unRegisterEvents = () => {
  isInitDetect = false;
  inActivityTimers.forEach((timers) => clearTimeout(timers));
  globalEventNames.forEach((name) => {
    window.removeEventListener(name, detectActivity);
  });
  inActivityEventQueue = {};
  activityEventMap = new Map();
};

export const eventHook = (ck: () => any, timeLength: number) => {
  if (!isFunction(ck)) return;
  inActivityTimes = uniq([...inActivityTimes, timeLength]);
  if (!inActivityEventQueue[timeLength]) {
    inActivityEventQueue[timeLength] = [];
  }
  inActivityEventQueue[timeLength].push(ck);
};

/**
 *
 * @param ck ck为页面进入静默时的回调，其返回未由静默到活跃的回调
 * @param timeLength 进入静默的检测时长
 * @param dependencies 依赖项
 */
export const detectHook = (
  ck: () => any,
  timeLength = defaultInActivityTime,
  dependencies: any[] = []
) => {
  useEffect(() => {
    hookCount++;
    if (!isInitDetect) registerEvents();
    return () => {
      hookCount--;
      if (hookCount === 0) {
        unRegisterEvents();
      }
    };
  }, []);
  useEffect(() => {
    eventHook(ck, timeLength);
    return () => {
      if (inActivityEventQueue[timeLength]) {
        const index = inActivityEventQueue[timeLength].indexOf(ck);
        if (index > -1) inActivityEventQueue[timeLength].splice(index, 1);
        activityEventMap.delete(ck);
      }
    };
  }, dependencies);
};
