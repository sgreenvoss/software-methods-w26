/*
File: HelpModal.jsx
Purpose: Provides some guidance to users on how to use basic features of the app
Creation Date:
Initial Author(s): Stella Greenvoss, Anna Norris

System Context:
Part of the larger frontend system. This placed with management buttons and username display to
help facillitate user experience.
*/

import React, { useState } from 'react';

export default function HelpModal({onClose}) {
    const [openItem, setOpenItem] = useState(null);

    const faqItems = [
      {
        question: 'How do I create a group?',
        steps: [
          'First, click on the "Show Groups" button',
          'Then click on "+ Create New Group"',
          'Enter the name of the group (this is shown to all invitees!)',
          'Add any existing users if you know their username',
          'Click "Create Group!" and copy the shareable link if you want to invite non-users/don\'t know all usernames',
          'If you need the shareable link again, click on the "Info" button for your new group'
        ]
      },
      {
        question: 'How do I see available times?',
        steps: [
          'First, create a group and wait for all members to accept your invitation',
          'Once everyone has joined, click on the "View" button in your to see how everybody\'s availability',
          'Hover over the calendar to see how many people are available, or check out the legend at the top of the calendar',
          'You can make a petition from this view by clicking on any green space in the calendar'
        ]
      },
      {
        question: 'How do I make a petition (and what is it)?',
        steps: [
          'A petition is a proposed time for your group members to meet',
          'Click on "View" in the group menu and then click on a time where everyone is available',
          'Finalize the petition details, including a name and whether you want it to repeat',
          'Then, click on "Finalize Event" and wait for your group members to respond',
          'If you don\'t see a petition made, try clicking on Sync Calendars to update any changes'
        ]
      },
      {
        question: 'How do I accept a petition?',
        steps: [
          'If you don\'t see a petition that you know was made, click on Sync Calendars to refresh your events',
          'You should see the petition as an orange event in the calendar',
          'Click on the petition and choose whether to accept or decline the petition',
        ]
      }
    ];

    const toggleItem = (index) => {
      setOpenItem((current) => (current === index ? null : index));
    };

    return (
    <div className="modal-backdrop">
      <div className="modal-shell">
        <div className="modal-header">
          <h2>How-to and FAQ</h2>
          <button className="cancel-btn" aria-label="Close help modal" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {faqItems.map((item, index) => {
            const isOpen = openItem === index;
            const panelId = `help-faq-panel-${index}`;

            return (
              <section key={item.question}>
                <button
                  id="help-question"
                  type="button"
                  onClick={() => toggleItem(index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  {item.question} {isOpen ? '-' : '+'}
                </button>

                {isOpen ? (
                  <ul id={panelId}>
                    {item.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
