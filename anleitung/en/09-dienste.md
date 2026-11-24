# Services

A service is a local application of a project, such as a dev server. The deck starts it when the project opens and shows in the footer whether it is running.

## Registering

1. Choose **{{ui.dienstHinterlegen}}** in the footer.
2. Give a name, an address and the start command. The command runs in the project directory. Leave it empty if the service is started elsewhere; the deck then only checks whether it can be reached.
3. At the first start the deck shows the command and asks for your confirmation. After that it starts it by itself as long as it stays unchanged. If someone changes the command, the deck asks again.

## Shared services

A project can offer a service to all projects, for example a tool that reads measurements from a photo. To do so, tick the box when registering and describe in one sentence what the service is good for.

- A shared service needs your confirmation. Until then it sits in the [inbox](05-eingang.md).
- After that the briefing of every new session names the service, in every project, with purpose and address.
- The confirmation applies to exactly the version shown. If name, address, purpose or command change, the deck asks again.

A session sees the services with `coop dienst liste` and starts one with `coop dienst starte <name>`.
