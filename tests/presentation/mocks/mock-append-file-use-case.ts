import { AppendFileUseCase } from "../../../src/domain/usecases/append-file.js";

export class MockAppendFileUseCase implements AppendFileUseCase {
  async appendFile(params: { projectName: string; fileName: string; content: string }): Promise<void> {
    // Mock implementation
    return;
  }
}

export const makeAppendFileUseCase = (): AppendFileUseCase => {
  return new MockAppendFileUseCase();
};