/** @odoo-module **/

import { Popover } from "@web/core/popover/popover";
import { usePosition } from "@web/core/position_hook";
import { registerCleanup } from "../../helpers/cleanup";
import { getFixture, makeDeferred, mount, nextTick, triggerEvent } from "../../helpers/utils";

let fixture;
let popoverTarget;

QUnit.module("Popover", {
    async beforeEach() {
        fixture = getFixture();

        popoverTarget = document.createElement("div");
        popoverTarget.id = "target";
        fixture.appendChild(popoverTarget);

        registerCleanup(() => {
            popoverTarget.remove();
        });
    },
});

QUnit.test("popover can have custom class", async (assert) => {
    await mount(Popover, fixture, {
        props: { target: popoverTarget, class: "custom-popover" },
    });

    assert.containsOnce(fixture, ".o_popover.custom-popover");
});

QUnit.test("popover can have more than one custom class", async (assert) => {
    await mount(Popover, fixture, {
        props: { target: popoverTarget, class: "custom-popover popover-custom" },
    });

    assert.containsOnce(fixture, ".o_popover.custom-popover.popover-custom");
});

QUnit.test("popover is rendered nearby target (default)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "bottom");
            assert.equal(variant, "middle");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget },
    });
});

QUnit.test("popover is rendered nearby target (bottom)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "bottom");
            assert.equal(variant, "middle");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget, position: "bottom" },
    });
});

QUnit.test("popover is rendered nearby target (top)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "top");
            assert.equal(variant, "middle");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget, position: "top" },
    });
});

QUnit.test("popover is rendered nearby target (left)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "left");
            assert.equal(variant, "middle");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget, position: "left" },
    });
});

QUnit.test("popover is rendered nearby target (right)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "right");
            assert.equal(variant, "middle");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget, position: "right" },
    });
});

QUnit.test("popover is rendered nearby target (bottom-start)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "bottom");
            assert.equal(variant, "start");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget, position: "bottom-start" },
    });
});

QUnit.test("popover is rendered nearby target (bottom-middle)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "bottom");
            assert.equal(variant, "middle");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget, position: "bottom-middle" },
    });
});

QUnit.test("popover is rendered nearby target (bottom-end)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "bottom");
            assert.equal(variant, "end");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget, position: "bottom-end" },
    });
});

QUnit.test("popover is rendered nearby target (bottom-fit)", async (assert) => {
    const TestPopover = class extends Popover {
        onPositioned(el, { direction, variant }) {
            assert.equal(direction, "bottom");
            assert.equal(variant, "fit");
        }
    };
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget, position: "bottom-fit" },
    });
});

QUnit.test("reposition popover should properly change classNames", async (assert) => {
    // Force some style, to make this test independent of screen size
    const container = document.createElement("div");
    container.id = "container";
    container.style.backgroundColor = "pink";
    container.style.height = "450px";
    container.style.width = "450px";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    popoverTarget.style.backgroundColor = "yellow";
    popoverTarget.style.height = "50px";
    popoverTarget.style.width = "50px";
    container.appendChild(popoverTarget);
    const sheet = document.createElement("style");
    sheet.textContent = `
        [role=tooltip] {
            background-color: cyan;
            height: 100px;
            width: 100px;
        }
    `;
    fixture.appendChild(container);
    document.head.appendChild(sheet);
    registerCleanup(() => {
        container.remove();
        sheet.remove();
    });

    const TestPopover = class extends Popover {
        setup() {
            // Don't call super.setup() in order to replace the use of usePosition hook...
            usePosition(this.props.target, {
                container,
                onPositioned: this.onPositioned.bind(this),
                position: this.props.position,
                popper: "ref",
            });
        }
    };

    await mount(TestPopover, container, { props: { target: popoverTarget } });
    const popover = container.querySelector("[role=tooltip]");
    const arrow = popover.firstElementChild;

    // Should have classes for a "bottom-middle" placement
    assert.strictEqual(
        popover.className,
        "o_popover popover mw-100 shadow-sm bs-popover-bottom o-popover-bottom o-popover--bm"
    );
    assert.strictEqual(arrow.className, "popover-arrow start-0 end-0 mx-auto");

    // Change container style and force update
    container.style.height = "125px"; // height of popper + 1/2 reference
    container.style.alignItems = "flex-end";
    triggerEvent(document, null, "scroll");
    await nextTick();

    // Should have classes for a "right-end" placement
    assert.strictEqual(
        popover.className,
        "o_popover popover mw-100 shadow-sm bs-popover-end o-popover-right o-popover--re"
    );
    assert.strictEqual(arrow.className, "popover-arrow top-auto");
});

QUnit.test("within iframe", async (assert) => {
    const iframe = document.createElement("iframe");
    iframe.style.height = "200px";
    iframe.srcdoc = `<div id="target" style="height:400px;">Within iframe</div>`;
    const def = makeDeferred();
    iframe.onload = def.resolve;
    fixture.appendChild(iframe);
    await def;

    let popoverEl;
    const TestPopover = class extends Popover {
        onPositioned(el, { direction }) {
            popoverEl = el;
            assert.step(direction);
        }
    };

    popoverTarget = iframe.contentDocument.getElementById("target");
    await mount(TestPopover, fixture, {
        props: { target: popoverTarget },
    });
    assert.verifySteps(["bottom"]);

    // The popover should be rendered outside the iframe
    assert.containsOnce(fixture, ".o_popover");
    assert.strictEqual(
        iframe.contentDocument.documentElement.querySelectorAll(".o_popover").length,
        0
    );

    // The popover should be rendered in the correct position
    const { top: targetTop, left: targetLeft } = popoverTarget.getBoundingClientRect();
    const { top: iframeTop, left: iframeLeft } = iframe.getBoundingClientRect();
    let popoverBox = popoverEl.getBoundingClientRect();
    let expectedTop = iframeTop + targetTop + popoverTarget.offsetHeight;
    let expectedLeft =
        iframeLeft + targetLeft + popoverTarget.offsetWidth / 2 - popoverBox.width / 2;
    assert.strictEqual(popoverBox.top, expectedTop);
    assert.strictEqual(popoverBox.left, expectedLeft);

    // Scrolling inside the iframe should reposition the popover accordingly
    const scrollOffset = 100;
    const scrollable = popoverTarget.ownerDocument.documentElement;
    scrollable.scrollTop = scrollOffset;
    await nextTick();
    assert.verifySteps(["bottom"]);
    popoverBox = popoverEl.getBoundingClientRect();
    expectedTop = iframeTop + targetTop + popoverTarget.offsetHeight - scrollOffset;
    expectedLeft = iframeLeft + targetLeft + popoverTarget.offsetWidth / 2 - popoverBox.width / 2;
    assert.strictEqual(popoverBox.top, expectedTop);
    assert.strictEqual(popoverBox.left, expectedLeft);
});
