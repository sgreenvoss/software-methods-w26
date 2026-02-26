import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EventSidebar from '../../../../components/Calendar/EventSidebar.jsx';

describe('EventSidebar', () => {
  test('updates draft event when form is complete', async () => {
    const setDraftEvent = jest.fn();

    const { container } = render(
      <EventSidebar
        setDraftEvent={setDraftEvent}
        onFinalize={() => {}}
        mode="blocking"
        setMode={() => {}}
        petitionGroupId=""
        setPetitionGroupId={() => {}}
        groupsList={[]}
      />
    );

    const titleInput = container.querySelector('input[type="text"]');
    const dateInput = container.querySelector('input[type="date"]');
    const timeInputs = container.querySelectorAll('input[type="time"]');

    fireEvent.change(titleInput, { target: { value: 'Focus time' } });
    fireEvent.change(dateInput, { target: { value: '2026-03-10' } });
    fireEvent.change(timeInputs[0], { target: { value: '09:00' } });
    fireEvent.change(timeInputs[1], { target: { value: '10:00' } });

    await waitFor(() => {
      expect(setDraftEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Focus time',
          mode: 'blocking',
          isPreview: true
        })
      );
    });
  });

  test('petition mode without selected group alerts and does not finalize', () => {
    const onFinalize = jest.fn();
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <EventSidebar
        setDraftEvent={() => {}}
        onFinalize={onFinalize}
        mode="petition"
        setMode={() => {}}
        petitionGroupId=""
        setPetitionGroupId={() => {}}
        groupsList={[{ group_id: 1, group_name: 'Alpha' }]}
      />
    );

    fireEvent.click(screen.getByText('Finalize Event'));

    expect(alertSpy).toHaveBeenCalledWith('Please select a group for the petition.');
    expect(onFinalize).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test('petition mode with selected group finalizes', () => {
    const onFinalize = jest.fn();

    render(
      <EventSidebar
        setDraftEvent={() => {}}
        onFinalize={onFinalize}
        mode="petition"
        setMode={() => {}}
        petitionGroupId="1"
        setPetitionGroupId={() => {}}
        groupsList={[{ group_id: 1, group_name: 'Alpha' }]}
      />
    );

    fireEvent.click(screen.getByText('Finalize Event'));

    expect(onFinalize).toHaveBeenCalledTimes(1);
  });
});
