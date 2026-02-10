import { createEventManagementModule, EventStore } from "./index.js";

describe("event_management module factory", () => {
  test("creates module with default model/view/controller", () => {
    const mod = createEventManagementModule();
    expect(mod.model).toBeInstanceOf(EventStore);
    expect(mod.view).toBeDefined();
    expect(mod.controller).toBeDefined();
  });

  test("uses injected model and view", () => {
    const model = {
      addManualEvent: () => ({ eventRef: "x" }),
    };
    const view = {
      eventBlockAdded: () => ({ ok: true, action: "manual_event_added" }),
    };

    const mod = createEventManagementModule({ model, view });
    expect(mod.model).toBe(model);
    expect(mod.view).toBe(view);

    const res = mod.controller.addEventBlock({});
    expect(res.ok).toBe(true);
    expect(res.action).toBe("manual_event_added");
  });
});
