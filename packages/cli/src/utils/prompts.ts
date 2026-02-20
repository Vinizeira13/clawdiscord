import inquirer from 'inquirer';

export async function confirmAction(message: string, defaultValue = true): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);
  return confirmed;
}

export async function selectFromList<T>(
  message: string,
  choices: { name: string; value: T }[]
): Promise<T> {
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message,
      choices,
    },
  ]);
  return selected;
}

export async function getInput(
  message: string,
  defaultValue?: string,
  validate?: (input: string) => boolean | string
): Promise<string> {
  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultValue,
      validate,
    },
  ]);
  return value;
}
