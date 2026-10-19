import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "@/app/page";

test("renders the home page and account navigation", () => {
  render(<Home />);

  expect(screen.getByRole("heading", { level: 1, name: "Questline" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/signup");
  expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
});
