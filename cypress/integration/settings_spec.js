describe("Settings", () => {
  context("Single user tab", () => {
    context("Desktop, 1280px width resolution", () => {
      beforeEach(() => {
        cy.viewport(1280, 720);

        cy.visit("localhost:1234/en");
      });

      it("display the title", () => {
        cy.contains("Settings");
      });

      it("display all controls", () => {
        cy.contains("Include weekends");
        cy.contains("Days range");
        cy.contains("Time range");
      });
    });

    context("Mobile, 600px width resolution", () => {
      it("display the title", () => {
        cy.viewport(320, 480);

        cy.visit("localhost:1234/en");

        cy.get(".settings").should("not.be.visible");
      });
    });
  });

  // TODO
  // context("Two user tab in the same browser")
  // context("Two different browsers")
});
