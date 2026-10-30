import {
  animateOrgDiagram,
  animateProjectDiagram,
  revealElements,
} from './diagramUtils';
import { REVEAL_DURATION, RevealClass } from './animations';
import {
  CELL_LINK,
  COMPONENT_LINK,
  COMPONENT_NODE,
  CONNECTION_NODE,
  EXTERNAL_LINK,
  MAIN_CELL,
  PROJECT_NODE,
} from '../resources';

function buildProjectDom(withCell = true): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    ${withCell ? `<div data-nodeid="${MAIN_CELL}" class="node"></div>` : ''}
    <div data-nodeid="${COMPONENT_NODE}|a" class="node"></div>
    <div data-nodeid="${COMPONENT_NODE}|b" class="node"></div>
    <div data-nodeid="${CONNECTION_NODE}|c" class="node"></div>
    <div data-nodeid="other|x" class="node"></div>
    <svg>
      <g data-linkid="${EXTERNAL_LINK}|1"></g>
      <g data-linkid="${COMPONENT_LINK}|2"></g>
      <g data-linkid="${CELL_LINK}|3"></g>
      <g data-linkid="unrelated|4"></g>
    </svg>
  `;
  return root;
}

describe('revealElements', () => {
  it('adds the reveal class and delay to every matching element', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p class="a"></p><p class="a"></p><p class="b"></p>';

    const count = revealElements('.a', RevealClass.FADE, 0.5, root);

    expect(count).toBe(2);
    root.querySelectorAll<HTMLElement>('.a').forEach(el => {
      expect(el.classList.contains(RevealClass.FADE)).toBe(true);
      expect(el.style.animationDelay).toBe('0.5s');
    });
    const untouched = root.querySelector<HTMLElement>('.b')!;
    expect(untouched.classList.contains(RevealClass.FADE)).toBe(false);
    expect(untouched.style.animationDelay).toBe('');
  });

  it('leaves the delay empty when no delay is requested', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p class="a"></p>';

    revealElements('.a', RevealClass.SCALE, 0, root);

    const el = root.querySelector<HTMLElement>('.a')!;
    expect(el.classList.contains(RevealClass.SCALE)).toBe(true);
    expect(el.style.animationDelay).toBe('');
  });

  it('returns 0 and does nothing when nothing matches', () => {
    const root = document.createElement('div');
    expect(revealElements('.missing', RevealClass.FADE, 0, root)).toBe(0);
  });

  it('re-applies the class so a second call restarts the animation', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p class="a"></p>';
    const el = root.querySelector<HTMLElement>('.a')!;
    const remove = jest.spyOn(el.classList, 'remove');

    revealElements('.a', RevealClass.FADE, 0, root);
    revealElements('.a', RevealClass.FADE, 0, root);

    expect(remove).toHaveBeenCalledWith(RevealClass.FADE);
    expect(el.classList.contains(RevealClass.FADE)).toBe(true);
  });
});

describe('animateProjectDiagram', () => {
  it('scales in the main cell and fades in its content after it', () => {
    const root = buildProjectDom();

    animateProjectDiagram(root);

    const cell = root.querySelector<HTMLElement>(
      `[data-nodeid="${MAIN_CELL}"]`,
    )!;
    expect(cell.classList.contains(RevealClass.SCALE)).toBe(true);
    expect(cell.style.animationDelay).toBe('');

    const faded = root.querySelectorAll<HTMLElement>(`.${RevealClass.FADE}`);
    expect(faded).toHaveLength(6);
    faded.forEach(el => {
      expect(el.style.animationDelay).toBe(`${REVEAL_DURATION}s`);
    });

    // elements not part of the diagram sequence are not animated
    expect(root.querySelector('[data-nodeid="other|x"]')!.className).toBe(
      'node',
    );
    expect(
      root.querySelector('[data-linkid="unrelated|4"]')!.getAttribute('class'),
    ).toBeNull();
  });

  it('fades content in immediately when there is no main cell', () => {
    const root = buildProjectDom(false);

    animateProjectDiagram(root);

    const faded = root.querySelectorAll<HTMLElement>(`.${RevealClass.FADE}`);
    expect(faded.length).toBeGreaterThan(0);
    faded.forEach(el => expect(el.style.animationDelay).toBe(''));
  });

  it('does not throw on an empty document', () => {
    expect(() =>
      animateProjectDiagram(document.createElement('div')),
    ).not.toThrow();
  });
});

describe('animateOrgDiagram', () => {
  it('scales in project nodes and fades in their links afterwards', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-nodeid="${PROJECT_NODE}|p1" class="node"></div>
      <div data-nodeid="${PROJECT_NODE}|p2" class="node"></div>
      <svg>
        <g data-default-link-test="${PROJECT_NODE}|p1-p2"></g>
        <g data-default-link-test="other|l"></g>
      </svg>
    `;

    animateOrgDiagram(root);

    const nodes = root.querySelectorAll<HTMLElement>(
      `.${RevealClass.SCALE_HALF}`,
    );
    expect(nodes).toHaveLength(2);
    nodes.forEach(el => expect(el.style.animationDelay).toBe(''));

    const links = root.querySelectorAll<HTMLElement>(`.${RevealClass.FADE}`);
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('data-default-link-test')).toBe(
      `${PROJECT_NODE}|p1-p2`,
    );
    expect(links[0].style.animationDelay).toBe(`${REVEAL_DURATION}s`);
  });

  it('fades links in immediately when there are no project nodes', () => {
    const root = document.createElement('div');
    root.innerHTML = `<svg><g data-default-link-test="${PROJECT_NODE}|l"></g></svg>`;

    animateOrgDiagram(root);

    const link = root.querySelector<HTMLElement>(`.${RevealClass.FADE}`)!;
    expect(link).not.toBeNull();
    expect(link.style.animationDelay).toBe('');
  });
});

describe('default root', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('queries the document when no root is given', () => {
    document.body.appendChild(buildProjectDom());
    document.body.innerHTML += `
      <div data-nodeid="${PROJECT_NODE}|p" class="node"></div>
      <svg><g data-default-link-test="${PROJECT_NODE}|l"></g></svg>
    `;

    expect(revealElements('.node', RevealClass.FADE)).toBe(6);
    animateProjectDiagram();
    animateOrgDiagram();

    const cell = document.querySelector<HTMLElement>(
      `div[data-nodeid="${MAIN_CELL}"]`,
    )!;
    expect(cell.classList.contains(RevealClass.SCALE)).toBe(true);
    const project = document.querySelector<HTMLElement>(
      `div[data-nodeid="${PROJECT_NODE}|p"]`,
    )!;
    expect(project.classList.contains(RevealClass.SCALE_HALF)).toBe(true);
  });
});
