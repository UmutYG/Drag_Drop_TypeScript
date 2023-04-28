// Code goes here!

type Listener = (items: ProjectItem[]) => void;

class ProjectState {
    private listeners: Listener[] = [];
    private projects: ProjectItem[] = [];
    private static instance: ProjectState;

    private constructor() {}

    static getInstance() {
        if (this.instance) {
            return this.instance;
        }
        this.instance = new ProjectState();
        return this.instance;
    }

    addListener(listener: Listener) {
        this.listeners.push(listener);
    }

    addProject(project: ProjectItem) {
        this.projects.push(project);

        this.notifySubscriptions();
    }

    notifySubscriptions() {
        for (const listenerFN of this.listeners) {
            listenerFN(this.projects.slice());
        }
    }

    moveProject(pId: string, newStatus: ProjectStatus) {
        const project = this.projects.find((p) => p.id === pId);
        // Extra if check for unwanted re-renders
        if (project && project.projectStatus !== newStatus) {
            project.projectStatus = newStatus;
            this.notifySubscriptions();
        }
    }
}

const projectState = ProjectState.getInstance();

interface Validateable {
    value: string | number;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
}

const validate = (field: Validateable) => {
    let isValid = true;
    if (field.required) {
        isValid = isValid && field.value.toString().trim().length !== 0;
    }

    if (field.minLength != null && typeof field.value === 'string') {
        isValid = isValid && field.value.trim().length >= field.minLength;
    }

    if (field.maxLength != null && typeof field.value === 'string') {
        isValid = isValid && field.value.trim().length <= field.maxLength;
    }

    if (field.min && typeof field.value === 'number') {
        isValid = isValid && field.value >= field.min;
    }

    if (field.max && typeof field.value === 'number') {
        isValid = isValid && field.value <= field.max;
    }

    return isValid;
};

function Autobind(_: any, _2: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const adjDescriptor: PropertyDescriptor = {
        configurable: true,
        get() {
            const boundFN = originalMethod.bind(this);
            return boundFN;
        }
    };

    return adjDescriptor;
}

abstract class Component<T extends HTMLElement, U extends HTMLElement> {
    hostingElement: T;
    insertElement: U;
    template: HTMLTemplateElement;

    constructor(
        hostId: string,
        templateId: string,
        renderPlace: InsertPosition,
        elementId?: string
    ) {
        this.hostingElement = document.querySelector(hostId) as T;
        this.template = document.getElementById(
            templateId
        ) as HTMLTemplateElement;
        const importedNode = document.importNode(this.template.content, true);

        this.insertElement = importedNode.firstElementChild! as U;

        if (elementId) {
            this.insertElement.id = `${elementId}-projects`;
        }

        this.renderElement(renderPlace, this.insertElement);
    }
    renderElement(place: InsertPosition, element: U) {
        this.hostingElement.insertAdjacentElement(place, element);
    }

    abstract configure(): void;
}

class ProjectInput {
    root: HTMLDivElement;
    template: HTMLTemplateElement;
    titleInput: HTMLInputElement;
    descriptionInput: HTMLInputElement;
    peopleInput: HTMLInputElement;

    constructor() {
        this.root = document.querySelector('#app')! as HTMLDivElement;
        this.template = document.getElementById(
            'project-input'
        )! as HTMLTemplateElement;

        const importedNode = document.importNode(this.template.content, true);

        importedNode.firstElementChild!.id = 'user-input';
        const contentToRender = importedNode.firstElementChild!;

        this.titleInput = contentToRender.querySelector(
            '#title'
        ) as HTMLInputElement;
        this.descriptionInput = contentToRender.querySelector(
            '#description'
        ) as HTMLInputElement;
        this.peopleInput = contentToRender.querySelector(
            '#people'
        ) as HTMLInputElement;

        this.root.insertAdjacentElement('afterbegin', contentToRender);

        this.hookSubmitListener();
    }

    private hookSubmitListener() {
        const form = document.querySelector('form')!;
        form.addEventListener('submit', this.submitForm);
    }

    private gatherForm(): [string, string, number] | void {
        const title = this.titleInput.value;
        const description = this.descriptionInput.value;
        const peopleCount = this.peopleInput.value;

        const titleValConfig: Validateable = {
            value: title,
            required: true,
            minLength: 1
        };

        const descriptionValConfig: Validateable = {
            value: description,
            required: true,
            minLength: 0
        };

        const peopleValConfig: Validateable = {
            value: +peopleCount,
            required: true,
            min: 1,
            max: 5
        };

        if (
            !validate(titleValConfig) ||
            !validate(descriptionValConfig) ||
            !validate(peopleValConfig)
        ) {
            alert('Please provide correct inputs.');
            return;
        }

        return [title, description, +peopleCount];
    }

    @Autobind
    private submitForm(e: SubmitEvent) {
        e.preventDefault();

        const gatheredInputs = this.gatherForm();

        if (Array.isArray(gatheredInputs)) {
            const addedPrj = new ProjectItem(
                gatheredInputs[0],
                gatheredInputs[1],
                gatheredInputs[2]
            );
            projectState.addProject(addedPrj);
        }
    }
}

class ProjectList
    extends Component<HTMLDivElement, HTMLUListElement>
    implements Droppable
{
    projects: ProjectItem[] = [];

    constructor(private type: ProjectStatus) {
        super(
            '#app',
            'project-list',
            'beforeend',
            type === ProjectStatus.Active ? 'active' : 'finished'
        );

        this.configure();

        this.renderContent();
    }

    configure() {
        this.insertElement.addEventListener('dragover', this.dragOverHandler);
        this.insertElement.addEventListener('dragleave', this.dragLeaveHandler);
        this.insertElement.addEventListener('drop', this.dropHandler);
        projectState.addListener((projects: ProjectItem[]) => {
            const filteredProjects = projects.filter((pItem) => {
                return pItem.projectStatus === this.type;
            });

            this.projects = filteredProjects;
            this.renderProjects();
        });
    }

    renderContent() {
        let title = this.type === ProjectStatus.Active ? 'active' : 'finished';
        const listId = `${title}-projects-list`;
        this.insertElement.querySelector('ul')!.id = listId;
        this.insertElement.querySelector('h2')!.textContent =
            title.toUpperCase() + ' PROJECTS';
        this.renderProjects();
    }

    renderProjects() {
        let title = this.type === ProjectStatus.Active ? 'active' : 'finished';

        const listEl = document.getElementById(
            `${title}-projects-list`
        )! as HTMLUListElement;

        listEl.innerHTML = '';
        for (const prjItem of this.projects) {
            prjItem.renderContent(listEl);
        }
    }

    @Autobind
    dragOverHandler(event: DragEvent): void {
        if (
            event.dataTransfer &&
            event.dataTransfer.types[0] === 'text/plain'
        ) {
            event.preventDefault();
            const listEl = this.insertElement.querySelector('ul')!;
            listEl.classList.add('droppable');
        }
    }

    @Autobind
    dropHandler(event: DragEvent): void {
        const id = event.dataTransfer!.getData('text/plain');
        projectState.moveProject(id, this.type);
    }

    @Autobind
    dragLeaveHandler(_: DragEvent): void {
        const listEl = this.insertElement.querySelector('ul')!;
        listEl.classList.remove('droppable');
    }
}

enum ProjectStatus {
    Active,
    Finished
}

interface Draggable {
    dragStartHandler(event: DragEvent): void;
    dragEndHandler(event: DragEvent): void;
}

interface Droppable {
    dragOverHandler(event: DragEvent): void;
    dropHandler(event: DragEvent): void;
    dragLeaveHandler(event: DragEvent): void;
}

class ProjectItem implements Draggable {
    public id: string;
    public title: string;
    public description: string;
    public peopleCount: number;
    public projectStatus: ProjectStatus;

    constructor(title: string, description: string, peopleCount: number) {
        this.id = Math.random().toString();
        this.title = title;
        this.description = description;
        this.peopleCount = peopleCount;
        this.projectStatus = ProjectStatus.Active;
    }

    configure(listItem: HTMLLIElement) {
        listItem.addEventListener('dragstart', this.dragStartHandler);
        listItem.addEventListener('dragend', this.dragEndHandler);
    }

    renderContent(hostEl: HTMLUListElement) {
        const listItem = document.createElement('li');
        const titleHTML = document.createElement('h3');
        const descHTML = document.createElement('p');
        descHTML.innerHTML = this.description;
        titleHTML.textContent = this.title;
        listItem.appendChild(titleHTML);
        listItem.appendChild(descHTML);
        listItem.draggable = true;
        hostEl.appendChild(listItem);
        this.configure(listItem);
    }
    @Autobind
    dragStartHandler(event: DragEvent): void {
        event.dataTransfer!.setData('text/plain', this.id);
        event.dataTransfer!.effectAllowed = 'move';
    }

    dragEndHandler(_: DragEvent): void {}
}

const projectInput = new ProjectInput();

const pListActive = new ProjectList(ProjectStatus.Active);
const pListFinished = new ProjectList(ProjectStatus.Finished);
