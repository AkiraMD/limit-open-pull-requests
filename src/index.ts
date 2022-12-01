import * as core from '@actions/core'
import * as github from '@actions/github'
import { Client } from './client'
import { Event } from './event'
import { Enforcer, Limits } from './enforcer'

async function run(): Promise<void> {
  try {
    if (
      github.context.eventName !== Event.PullRequest ||
      github.context.payload.pull_request === undefined
    ) {
      core.setFailed('This action can only be used with pull request events')
      return
    }
    const triggeringPRNumber: number = github.context.payload.pull_request.number

    const repoToken = core.getInput('repo-token')

    const repoLimitInput = core.getInput('repo-limit')
    const repoLimit = repoLimitInput ? Number(repoLimitInput) : undefined

    const perAuthorLimitInput = core.getInput('per-author-limit')
    const perAuthorLimit = perAuthorLimitInput ? Number(perAuthorLimitInput) : undefined

    const perLabelLimitInput = core.getInput('per-label-limit')
    const perLabelLimit = perLabelLimitInput ? Number(perLabelLimitInput) : undefined

    const limitedLabelsInput = core.getInput('limited-labels').split(',')
    let limitedLabels: string[] | undefined
    if (limitedLabelsInput.length > 0) {
      limitedLabels = limitedLabelsInput.map((label) => label.trim())
    }

    const limits: Limits = {
      repoLimit,
      perAuthorLimit,
      perLabelLimit,
      limitedLabels,
    }

    const { owner, repo } = github.context.repo
    const client = new Client(repoToken, owner, repo)
    const enforcer = new Enforcer(client, limits, triggeringPRNumber)

    await enforcer.enforceLimits()
  } catch (error) {
    core.setFailed(error.message)
  }
}
run()

export default run
