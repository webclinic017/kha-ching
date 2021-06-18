import axios from 'axios';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';

import { commonOnChangeHandler, getSchedulingStateProps } from '../../../lib/browserUtils';
import { EXIT_STRATEGIES, STRATEGIES_DETAILS } from '../../../lib/constants';
import Details from './TradeSetupDetails';
import Form from './TradeSetupForm';

/**
 *
 * lets show the details popup per instrument
 * set the actionable as "remove job" to clean up memory
 *
 * on the "days" section, show all jobs of the day only
 * and automatically clean up any jobs that belong to days before today
 */

const AtmStraddle = ({
  LOCALSTORAGE_KEY,
  strategy,
  enabledInstruments,
  exitStrategies = [EXIT_STRATEGIES.INDIVIDUAL_LEG_SLM_1X]
}) => {
  const { heading, defaultRunAt } = STRATEGIES_DETAILS[strategy];
  const [db, setDb] = useState(() => {
    const existingDb =
      typeof window !== 'undefined' && localStorage.getItem(LOCALSTORAGE_KEY)
        ? JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY))
        : null;

    if (!existingDb) {
      return {};
    }

    return existingDb;
  });

  const getDefaultState = () => ({
    ...STRATEGIES_DETAILS[strategy].defaultFormState,
    ...getSchedulingStateProps(strategy)
  });

  // {
  //   return {
  //     instruments: enabledInstruments.reduce(
  //       (accum, item) => ({
  //         ...accum,
  //         [item]: false
  //       }),
  //       {}
  //     ),
  //     lots: defaultLots,
  //     maxSkewPercent: process.env.NEXT_PUBLIC_DEFAULT_SKEW_PERCENT,
  //     slmPercent: process.env.NEXT_PUBLIC_DEFAULT_SLM_PERCENT,
  //     runNow: false,
  //     runAt: getScheduleableTradeTime(),
  //     expireIfUnsuccessfulInMins: 10,
  //     exitStrategy: exitStrategies[0],
  //     isAutoSquareOffEnabled: true,
  //     squareOffTime: getDefaultSquareOffTime()
  //   };
  // }

  const [state, setState] = useState(getDefaultState());

  useEffect(() => {
    async function fn() {
      try {
        if (!Object.isExtensible(db)) return;
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(db));
      } catch (e) {
        console.log(e);
      }
    }

    fn();
  }, [db]);

  const onSubmit = async (e) => {
    e && e.preventDefault();

    if (state.runNow) {
      const yes = await window.confirm('This will schedule this trade immediately. Are you sure?');
      if (!yes) {
        setState({
          ...state,
          runNow: false
        });
        return;
      }
    }

    const {
      lots,
      maxSkewPercent,
      slmPercent,
      runNow,
      runAt,
      expireIfUnsuccessfulInMins,
      exitStrategy,
      isAutoSquareOffEnabled,
      squareOffTime
    } = state;

    const jobProps = {
      instruments: Object.keys(state.instruments).filter((key) => state.instruments[key]),
      lots,
      maxSkewPercent,
      slmPercent,
      runNow,
      runAt: runNow ? dayjs().format() : runAt,
      expireIfUnsuccessfulInMins,
      strategy,
      exitStrategy,
      isAutoSquareOffEnabled,
      squareOffTime: isAutoSquareOffEnabled ? dayjs(squareOffTime).set('seconds', 0).format() : null
    };

    try {
      const { data } = await axios.post('/api/create_job', jobProps);
      setDb((exDb) => ({
        queue: Array.isArray(exDb.queue) ? [...data, ...exDb.queue] : data
      }));
      setState(getDefaultState());

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const onChange = (props) => commonOnChangeHandler(props, state, setState);

  const onDeleteJob = async ({ jobId } = {}) => {
    if (!jobId) {
      throw new Error('onDeleteJob called without jobId');
    }

    const queueWithoutJobId = db.queue.filter((job) => job.id !== jobId);
    setDb((exDb) => ({
      ...exDb,
      queue: queueWithoutJobId
    }));

    try {
      await axios.post('/api/delete_job', {
        id: jobId
      });
    } catch (e) {
      console.log('error deleting job', e);
    }
  };

  useEffect(() => {
    if (state.runNow) {
      onSubmit();
    }
  }, [state.runNow]);

  return (
    <div style={{ marginBottom: '60px' }}>
      <h3>{heading}</h3>
      {db.queue?.length
        ? db.queue.map((job) => (
            <Details key={job.name} job={job} strategy={strategy} onDeleteJob={onDeleteJob} />
          ))
        : null}
      <Form
        state={state}
        onChange={onChange}
        onSubmit={onSubmit}
        enabledInstruments={enabledInstruments}
        exitStrategies={exitStrategies}
      />
    </div>
  );
};

export default AtmStraddle;