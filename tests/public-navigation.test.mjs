import test from "node:test";
import assert from "node:assert/strict";
import {
  publicNavigation,
  isNavHrefActive,
  isNavItemActive,
} from "../lib/public-navigation.js";

test("public navigation keeps top-level set small with Community and Explore groups", () => {
  const top = publicNavigation.map((i) => i.label);
  assert.deepEqual(top, [
    "About",
    "Apply",
    "Scholars",
    "Community",
    "Explore",
    "News",
    "Contact",
  ]);

  const community = publicNavigation.find((i) => i.label === "Community");
  assert.deepEqual(
    community.children.map((c) => c.href),
    ["/teams", "/alumni"]
  );

  const explore = publicNavigation.find((i) => i.label === "Explore");
  assert.deepEqual(
    explore.children.map((c) => c.href),
    ["/projects", "/events"]
  );
});

test("nav active helpers mark parents when a child route is active", () => {
  assert.equal(isNavHrefActive("/teams", "/teams"), true);
  assert.equal(isNavHrefActive("/teams/mentors/x", "/teams"), true);
  assert.equal(isNavHrefActive("/about", "/teams"), false);
  assert.equal(isNavHrefActive("/", "/#contact"), false);

  const community = publicNavigation.find((i) => i.label === "Community");
  assert.equal(isNavItemActive("/alumni", community), true);
  assert.equal(isNavItemActive("/news", community), false);
});
