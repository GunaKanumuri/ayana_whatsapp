import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Mock react-router-dom
jest.mock("react-router-dom", () => ({
  useNavigate: jest.fn(),
  BrowserRouter: ({ children }) => <div>{children}</div>,
}));

// Mock the API using the @/ alias — this is how Onboarding.js imports it
jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn((url) => {
      if (url === "/parents") return Promise.resolve({ data: [] });
      if (url === "/payment/state") return Promise.resolve({ data: { state: { plan: "nitya" } } });
      return Promise.resolve({ data: {} });
    }),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
  formatApiError: (err) => err,
}));

// Mock AuthContext — Onboarding.js imports via @/context/AuthContext
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Test User", phone: "+919876543210", onboarding_step: 0 },
    config: {
      languages: [{ code: "en", label: "English" }, { code: "te", label: "Telugu" }],
      relationships: ["mother", "father"],
      categories: [{ key: "morning_wish", label: "Morning wish", type: "checkin", icon: "sunrise" }],
      plans: [
        { id: "nitya", name: "AYANA Nitya", limits: { parents: 1, checkins: 2, reminders: 2 } },
        { id: "bandham", name: "AYANA Bandham", limits: { parents: 2, checkins: 3, reminders: 3 } },
      ],
      currencies: [{ code: "USD", symbol: "$", label: "USD" }],
    },
    refreshUser: jest.fn(),
  }),
}));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import Onboarding from "./Onboarding";

describe("Onboarding Component", () => {
  test("renders welcome step and child details form", async () => {
    render(<Onboarding />);

    // Step 0 check
    expect(await screen.findByText(/Let's bring you closer to home/i)).toBeInTheDocument();
    expect(screen.getByTestId("child-name")).toBeInTheDocument();
  });

  test("shows plan-first steps", async () => {
    render(<Onboarding />);
    // Verify the step labels in the header
    expect(screen.getByText(/Your plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Your parents/i)).toBeInTheDocument();
  });
});
