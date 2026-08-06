import { act } from 'react';
import userEvent from '@testing-library/user-event';

/**
 * `@testing-library/user-event` v13 dispatches synchronously, so awaiting it does
 * not flush the promise chain our async state updates depend on. Wrapping the
 * click in an async `act` flushes pending microtasks inside React's batching
 * window, which is what keeps "not wrapped in act(...)" warnings out of the
 * output. (v14 made click async and this helper would be unnecessary.)
 */
export async function click(element) {
  await act(async () => {
    userEvent.click(element);
  });
}

export default click;
