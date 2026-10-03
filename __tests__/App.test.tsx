/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../src/App';

// React Navigation schedules timers; fake them so none fire after the test ends.
jest.useFakeTimers();

// The Map tab loads walk spots on mount; answer with an empty list instead of hitting the network.
jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
  Promise.resolve(
    new Response(JSON.stringify({ spots: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ),
);

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
});
