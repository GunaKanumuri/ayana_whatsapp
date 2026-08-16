import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Mock react-router-dom
jest.mock("react-router-dom", () => ({
  useNavigate: jest.fn(),
  BrowserRouter: ({ children }) => <div>{children}</div>,
}));

// Mock the API — must be hoisted before import
jest.mock("../lib/api", () => {
  const mockApi = {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  };
  return {
    api: mockApi,
    formatApiError: (err) => err,
    __mockApi: mockApi, // export for test setup
  };
});

// Mock AuthContext
jest.mock("../context/AuthContext", () => ({
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

// Import after mocks
import { __mockApi as mockApi } from "../lib/api";
import Onboarding from "./Onboarding";

describe("Onboarding Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.get.mockImplementation((url) => {
      if (url === "/parents") return Promise.resolve({ data: [] });
      if (url === "/payment/state") return Promise.resolve({ data: { state: { plan: "nitya" } } });
      if (url === "/schedules") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    mockApi.put.mockResolvedValue({ data: {} });
    mockApi.post.mockResolvedValue({ data: {} });
  });

  test("renders welcome step and child details form", async () => {
    render(<Onboarding />);

    // Step 0 check
    expect(await screen.findByText(/Let's bring you closer to home/i)).toBeInTheDocument();
    expect(screen.getByTestId("child-name")).toBeInTheDocument();
  });

  test("shows updated onboarding steps", async () => {
    render(<Onboarding />);
    // Verify the new 4 step labels in the header
    expect(screen.getByText(/Your plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Your parents/i)).toBeInTheDocument();
    expect(screen.getByText(/Activate/i)).toBeInTheDocument();
    // Verify Daily rhythm is NOT in the header steps
    expect(screen.queryByText(/Daily rhythm/i)).not.toBeInTheDocument();
  });
});